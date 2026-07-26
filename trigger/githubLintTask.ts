import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import * as Sentry from "@sentry/nextjs";
import { schemaTask } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import db from "@/db";
import { githubPrScans, type LintReportJson } from "@/db/schema";
import { getScanningUser } from "@/lib/discord-scanning-user";
import { getInstallationToken } from "@/lib/github/app-auth";
import {
  completeCheckRun,
  createCheckRun,
  type PullRequestFileDiff,
} from "@/lib/github/checks";
import { sendGitHubPrScanDiscordAlertBestEffort } from "@/lib/github/discord-notification";
import { getInstallationUserId } from "@/lib/github/installations";
import { githubLintPayload } from "@/lib/validation/github";
import {
  createEmptyLintReport,
  MAX_DIRECTORY_DEPTH,
  MAX_PROJECT_FILES,
  MAX_SQL_FILES,
  runLintPipeline,
  SQLFLUFF_LOCKED_CONFIG_CONTENTS,
  TASK_QUEUE_CONCURRENCY,
  UserFacingLintFailure,
} from "@/trigger/lintPipeline";
import {
  isMacroResolutionSupportPath,
  resolveMacroAllowlist,
} from "@/trigger/macroResolution";

type GitHubFileContent = {
  type?: string;
  encoding?: string;
  content?: string;
};

const MAX_MACRO_RESOLUTION_FILE_BYTES = 1024 * 1024;
const MAX_MACRO_RESOLUTION_TOTAL_BYTES = 20 * 1024 * 1024;

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
    .returning({
      scanId: githubPrScans.scanId,
      checkRunId: githubPrScans.checkRunId,
    });

  if (!scan) throw new Error("Failed to create GitHub PR scan");
  return scan;
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

async function persistCheckRunId(scanId: string, checkRunId: string) {
  await db
    .update(githubPrScans)
    .set({ checkRunId })
    .where(eq(githubPrScans.scanId, scanId));
}

function reportCheckRunError({
  operation,
  error,
  scanId,
  repoFullName,
  prNumber,
  headSha,
}: {
  operation: "create" | "persist" | "complete";
  error: unknown;
  scanId: string;
  repoFullName: string;
  prNumber: number;
  headSha: string;
}) {
  console.error(`Failed to ${operation} GitHub check run`, {
    error,
    scanId,
    repoFullName,
    prNumber,
    headSha,
  });
  Sentry.captureException(error, {
    tags: {
      integration: "github_checks",
      github_check_operation: operation,
    },
    extra: { scanId, repoFullName, prNumber, headSha },
  });
}

async function completeCheckRunBestEffort({
  octokit,
  owner,
  repo,
  checkRunId,
  conclusion,
  report,
  changedFiles,
  scanId,
  repoFullName,
  prNumber,
  headSha,
}: {
  octokit: Octokit | null;
  owner: string;
  repo: string;
  checkRunId: string | null;
  conclusion: "success" | "failure";
  report: LintReportJson;
  changedFiles: readonly PullRequestFileDiff[];
  scanId: string;
  repoFullName: string;
  prNumber: number;
  headSha: string;
}) {
  if (!octokit || !checkRunId) return;

  try {
    const { annotationsPosted } = await completeCheckRun({
      octokit,
      owner,
      repo,
      checkRunId,
      conclusion,
      report,
      changedFiles,
    });
    console.log("GitHub check run completed", {
      scanId,
      checkRunId,
      conclusion,
      annotationsPosted,
    });
  } catch (error) {
    reportCheckRunError({
      operation: "complete",
      error,
      scanId,
      repoFullName,
      prNumber,
      headSha,
    });
  }
}

async function fetchChangedSqlFiles({
  octokit,
  owner,
  repo,
  prNumber,
  headSha,
  rootDirectory,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  rootDirectory: string;
}) {
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

  return {
    count: sqlFiles.length,
    files: sqlFiles.map(({ filename, patch }) => ({ filename, patch })),
  };
}

async function fetchMacroResolutionFiles({
  octokit,
  owner,
  repo,
  headSha,
  rootDirectory,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  headSha: string;
  rootDirectory: string;
}) {
  let tree: Awaited<ReturnType<typeof octokit.rest.git.getTree>>["data"];
  try {
    const response = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: headSha,
      recursive: "1",
    });
    tree = response.data;
  } catch (error) {
    if (authenticationFailure(error)) {
      throw new UserFacingLintFailure(
        "GitHub installation authentication is invalid or expired. Reconnect the GitHub App and try again.",
      );
    }
    throw new Error(
      `GitHub failed to inspect macro-resolution files for ${owner}/${repo} at ${headSha}`,
      { cause: error },
    );
  }

  if (tree.truncated) {
    throw new UserFacingLintFailure(
      "GitHub returned a truncated repository tree, so project macros cannot be resolved safely",
    );
  }

  const supportFiles = tree.tree.filter(
    (entry) =>
      entry.type === "blob" &&
      entry.mode !== "120000" &&
      isMacroResolutionSupportPath(entry.path),
  );
  if (supportFiles.length > MAX_PROJECT_FILES) {
    throw new UserFacingLintFailure(
      `Macro-resolution file count exceeds the limit of ${MAX_PROJECT_FILES.toLocaleString()}`,
    );
  }

  const warnings: string[] = [];
  let downloadedFileCount = 0;
  let downloadedBytes = 0;
  for (const file of supportFiles) {
    if (
      typeof file.size === "number" &&
      file.size > MAX_MACRO_RESOLUTION_FILE_BYTES
    ) {
      warnings.push(`Ignoring oversized macro-resolution file ${file.path}`);
      continue;
    }

    let data: Awaited<ReturnType<typeof octokit.rest.git.getBlob>>["data"];
    try {
      const response = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: file.sha,
      });
      data = response.data;
    } catch (error) {
      if (authenticationFailure(error)) {
        throw new UserFacingLintFailure(
          "GitHub installation authentication is invalid or expired. Reconnect the GitHub App and try again.",
        );
      }
      throw new Error(
        `GitHub failed to fetch macro-resolution file ${file.path} at ${headSha}`,
        { cause: error },
      );
    }

    if (data.encoding !== "base64") {
      throw new UserFacingLintFailure(
        `GitHub did not return downloadable file content for ${file.path}`,
      );
    }
    const contents = Buffer.from(data.content.replace(/\s/g, ""), "base64");
    if (contents.byteLength > MAX_MACRO_RESOLUTION_FILE_BYTES) {
      warnings.push(`Ignoring oversized macro-resolution file ${file.path}`);
      continue;
    }
    downloadedBytes += contents.byteLength;
    if (downloadedBytes > MAX_MACRO_RESOLUTION_TOTAL_BYTES) {
      throw new UserFacingLintFailure(
        `Macro-resolution files exceed the combined limit of ${MAX_MACRO_RESOLUTION_TOTAL_BYTES.toLocaleString()} bytes`,
      );
    }

    const destination = safeDestinationPath(rootDirectory, file.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
    downloadedFileCount += 1;
  }

  return { downloadedFileCount, warnings };
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
    if (!userId) {
      throw new UserFacingLintFailure(
        `GitHub installation ${installationId} is not connected to a dbtLint user`,
      );
    }
    const scan = await startGitHubPrScan({
      userId,
      installationId,
      repoFullName,
      prNumber,
      headSha,
    });
    const { scanId } = scan;
    let checkRunId = scan.checkRunId;
    let octokit: Octokit | null = null;
    let changedSqlFiles: PullRequestFileDiff[] = [];
    const tmpDirectory = path.join(os.tmpdir(), "github-pr-scan", scanId);
    const repositoryDirectory = path.join(tmpDirectory, "repository");
    const macroResolutionDirectory = path.join(
      tmpDirectory,
      "macro-resolution",
    );
    const lockedConfigPath = path.join(tmpDirectory, "sqlfluff.locked.ini");

    try {
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
      octokit = new Octokit({ auth: token });

      if (!checkRunId) {
        try {
          checkRunId = await createCheckRun({
            octokit,
            owner,
            repo,
            headSha,
            scanId,
          });
          try {
            await persistCheckRunId(scanId, checkRunId);
          } catch (error) {
            reportCheckRunError({
              operation: "persist",
              error,
              scanId,
              repoFullName,
              prNumber,
              headSha,
            });
          }
        } catch (error) {
          reportCheckRunError({
            operation: "create",
            error,
            scanId,
            repoFullName,
            prNumber,
            headSha,
          });
        }
      }

      mkdirSync(repositoryDirectory, { recursive: true });
      writeFileSync(lockedConfigPath, SQLFLUFF_LOCKED_CONFIG_CONTENTS, "utf8");
      const fetchedSqlFiles = await fetchChangedSqlFiles({
        octokit,
        owner,
        repo,
        prNumber,
        headSha,
        rootDirectory: repositoryDirectory,
      });
      changedSqlFiles = fetchedSqlFiles.files;
      mkdirSync(macroResolutionDirectory, { recursive: true });
      const fetchedMacroResolutionFiles = await fetchMacroResolutionFiles({
        octokit,
        owner,
        repo,
        headSha,
        rootDirectory: macroResolutionDirectory,
      });
      const macroResolution = resolveMacroAllowlist(
        macroResolutionDirectory,
        MAX_DIRECTORY_DEPTH,
      );
      const macroResolutionWarnings = [
        ...fetchedMacroResolutionFiles.warnings,
        ...macroResolution.warnings,
      ];
      if (macroResolutionWarnings.length > 0) {
        console.warn(
          "GitHub PR macro resolution completed with reduced awareness",
          {
            scanId,
            warnings: macroResolutionWarnings,
          },
        );
      }
      const { report } = await runLintPipeline({
        rootDirectory: repositoryDirectory,
        dialect: "snowflake",
        lockedConfigPath,
        allowedMacroVariables: macroResolution.allowedVariables,
      });
      const status = report.totals.errors === 0 ? "passed" : "failed";
      await finalizeGitHubPrScan({ scanId, status, report });
      const scanningUser = await getScanningUser(userId);
      await sendGitHubPrScanDiscordAlertBestEffort({
        scanId,
        repoFullName,
        prNumber,
        headSha,
        report,
        scanningUser,
      });
      await completeCheckRunBestEffort({
        octokit,
        owner,
        repo,
        checkRunId,
        conclusion: report.totals.errors === 0 ? "success" : "failure",
        report,
        changedFiles: changedSqlFiles,
        scanId,
        repoFullName,
        prNumber,
        headSha,
      });
      console.log("GitHub PR lint completed", {
        scanId,
        installationId,
        repoFullName,
        prNumber,
        headSha,
        fetchedSqlFileCount: fetchedSqlFiles.count,
        fetchedMacroResolutionFileCount:
          fetchedMacroResolutionFiles.downloadedFileCount,
        resolvedPackageMacroNamespaces: Array.from(macroResolution.namespaces),
        resolvedLocalMacros: Array.from(macroResolution.localMacros),
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
      await completeCheckRunBestEffort({
        octokit,
        owner,
        repo,
        checkRunId,
        conclusion: "failure",
        report,
        changedFiles: changedSqlFiles,
        scanId,
        repoFullName,
        prNumber,
        headSha,
      });
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
