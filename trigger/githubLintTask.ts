import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import * as Sentry from "@sentry/nextjs";
import { schemaTask } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import db from "@/db";
import {
  githubInstallations,
  githubPrScans,
  type LintReportJson,
} from "@/db/schema";
import { getInstallationToken } from "@/lib/github/app-auth";
import { githubLintPayload } from "@/lib/validation/github";
import {
  createEmptyLintReport,
  MAX_SQL_FILES,
  runLintPipeline,
  SQLFLUFF_LOCKED_CONFIG_CONTENTS,
  TASK_QUEUE_CONCURRENCY,
  UserFacingLintFailure,
} from "@/trigger/lintPipeline";

type GitHubFileContent = {
  type?: string;
  encoding?: string;
  content?: string;
};

function parseRepositoryName(repoFullName: string) {
  const parts = repoFullName.split("/");
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    throw new UserFacingLintFailure(
      `Invalid GitHub repository name: ${repoFullName}`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

function githubErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }
  return typeof error.status === "number" ? error.status : null;
}

function authenticationFailure(error: unknown) {
  const status = githubErrorStatus(error);
  if (status === 401) return true;
  if (status !== 403 || typeof error !== "object" || error === null) {
    return false;
  }
  const response = "response" in error ? error.response : null;
  if (typeof response !== "object" || response === null) return true;
  const headers = "headers" in response ? response.headers : null;
  if (typeof headers !== "object" || headers === null) return true;
  return (
    !("x-ratelimit-remaining" in headers) ||
    headers["x-ratelimit-remaining"] !== "0"
  );
}

function safeDestinationPath(rootDirectory: string, repoPath: string) {
  const normalizedRepoPath = repoPath.replace(/\\/g, "/");
  const destination = path.resolve(rootDirectory, normalizedRepoPath);
  const relative = path.relative(path.resolve(rootDirectory), destination);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    normalizedRepoPath.startsWith("/")
  ) {
    throw new UserFacingLintFailure(
      `Unsafe GitHub file path rejected: ${repoPath}`,
    );
  }
  return destination;
}

async function getInstallationUserId(installationId: number) {
  const [installation] = await db
    .select({ userId: githubInstallations.userId })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, String(installationId)))
    .limit(1);

  if (!installation) {
    throw new UserFacingLintFailure(
      `GitHub installation ${installationId} is not connected to a dbtLint user`,
    );
  }
  return installation.userId;
}

async function startGitHubPrScan({
  userId,
  installationId,
  repoFullName,
  prNumber,
  headSha,
}: {
  userId: string;
  installationId: number;
  repoFullName: string;
  prNumber: number;
  headSha: string;
}) {
  const [scan] = await db
    .insert(githubPrScans)
    .values({
      userId,
      project: `${repoFullName} #${prNumber}`,
      scanId: randomUUID(),
      status: "processing",
      repositoryFullName: repoFullName,
      prNumber,
      headSha,
      installationId: String(installationId),
    })
    .onConflictDoUpdate({
      target: [
        githubPrScans.repositoryFullName,
        githubPrScans.prNumber,
        githubPrScans.headSha,
      ],
      set: {
        status: "processing",
        score: 0,
        errors: 0,
        warnings: 0,
        report: null,
      },
    })
    .returning({ scanId: githubPrScans.scanId });

  if (!scan) throw new Error("Failed to create GitHub PR scan");
  return scan.scanId;
}

async function finalizeGitHubPrScan({
  scanId,
  status,
  report,
}: {
  scanId: string;
  status: "passed" | "failed";
  report: LintReportJson;
}) {
  await db
    .update(githubPrScans)
    .set({
      status,
      score: report.score,
      errors: report.totals.errors,
      warnings: report.totals.warnings,
      report,
    })
    .where(eq(githubPrScans.scanId, scanId));
}

async function fetchChangedSqlFiles({
  installationId,
  owner,
  repo,
  prNumber,
  headSha,
  rootDirectory,
}: {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  rootDirectory: string;
}) {
  let token: string;
  try {
    token = await getInstallationToken(installationId);
  } catch (error) {
    console.error("Failed to create GitHub installation token", {
      installationId,
      error,
    });
    throw new UserFacingLintFailure(
      "GitHub installation authentication failed. Reconnect the GitHub App and try again.",
    );
  }

  const octokit = new Octokit({ auth: token });
  let changedFiles: Awaited<
    ReturnType<typeof octokit.rest.pulls.listFiles>
  >["data"];
  try {
    changedFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });
  } catch (error) {
    if (authenticationFailure(error)) {
      throw new UserFacingLintFailure(
        "GitHub installation authentication is invalid or expired. Reconnect the GitHub App and try again.",
      );
    }
    throw new Error(
      `GitHub failed to list changed files for ${owner}/${repo}#${prNumber}`,
      { cause: error },
    );
  }

  const sqlFiles = changedFiles.filter(
    (file) =>
      file.status !== "removed" &&
      path.posix.extname(file.filename).toLowerCase() === ".sql",
  );
  if (sqlFiles.length === 0) {
    throw new UserFacingLintFailure(
      "No changed SQL files found in this pull request",
    );
  }
  if (sqlFiles.length > MAX_SQL_FILES) {
    throw new UserFacingLintFailure(
      `Changed SQL file count exceeds the limit of ${MAX_SQL_FILES.toLocaleString()}`,
    );
  }

  for (const file of sqlFiles) {
    let data: unknown;
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: headSha,
      });
      data = response.data;
    } catch (error) {
      if (authenticationFailure(error)) {
        throw new UserFacingLintFailure(
          "GitHub installation authentication is invalid or expired. Reconnect the GitHub App and try again.",
        );
      }
      throw new Error(`GitHub failed to fetch ${file.filename} at ${headSha}`, {
        cause: error,
      });
    }

    if (
      Array.isArray(data) ||
      typeof data !== "object" ||
      data === null ||
      (data as GitHubFileContent).type !== "file" ||
      (data as GitHubFileContent).encoding !== "base64" ||
      typeof (data as GitHubFileContent).content !== "string"
    ) {
      throw new UserFacingLintFailure(
        `GitHub did not return downloadable file content for ${file.filename}`,
      );
    }

    const destination = safeDestinationPath(rootDirectory, file.filename);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      Buffer.from((data as GitHubFileContent).content ?? "", "base64"),
    );
  }

  return sqlFiles.length;
}

export const githubLintTask = schemaTask({
  id: "github-lint",
  schema: githubLintPayload,
  machine: { preset: "small-2x" },
  queue: { concurrencyLimit: TASK_QUEUE_CONCURRENCY },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async ({ installationId, repoFullName, prNumber, headSha }) => {
    const { owner, repo } = parseRepositoryName(repoFullName);
    const userId = await getInstallationUserId(installationId);
    const scanId = await startGitHubPrScan({
      userId,
      installationId,
      repoFullName,
      prNumber,
      headSha,
    });
    const tmpDirectory = path.join(os.tmpdir(), "github-pr-scan", scanId);
    const repositoryDirectory = path.join(tmpDirectory, "repository");
    const lockedConfigPath = path.join(tmpDirectory, "sqlfluff.locked.ini");

    try {
      mkdirSync(repositoryDirectory, { recursive: true });
      writeFileSync(lockedConfigPath, SQLFLUFF_LOCKED_CONFIG_CONTENTS, "utf8");
      const fetchedSqlFileCount = await fetchChangedSqlFiles({
        installationId,
        owner,
        repo,
        prNumber,
        headSha,
        rootDirectory: repositoryDirectory,
      });
      const { report } = await runLintPipeline({
        rootDirectory: repositoryDirectory,
        dialect: "snowflake",
        lockedConfigPath,
      });
      const status = report.totals.errors === 0 ? "passed" : "failed";
      await finalizeGitHubPrScan({ scanId, status, report });
      console.log("GitHub PR lint completed", {
        scanId,
        installationId,
        repoFullName,
        prNumber,
        headSha,
        fetchedSqlFileCount,
        score: report.score,
        errors: report.totals.errors,
        warnings: report.totals.warnings,
      });
      return report;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown GitHub lint error";
      const report =
        error instanceof UserFacingLintFailure && error.report
          ? error.report
          : createEmptyLintReport(message);
      await finalizeGitHubPrScan({ scanId, status: "failed", report });
      if (error instanceof UserFacingLintFailure) return report;
      Sentry.captureException(error, {
        extra: { installationId, repoFullName, prNumber, headSha, scanId },
      });
      throw error;
    } finally {
      rmSync(tmpDirectory, { recursive: true, force: true });
    }
  },
});
