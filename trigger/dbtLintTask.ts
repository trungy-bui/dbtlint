import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { metadata, retry, schemaTask, task } from "@trigger.dev/sdk";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import db from "@/db";
import { type LintReportJson, notifications, scans } from "@/db/schema";
import { sendDiscordAlert } from "@/lib/discord";
import {
  formatCategoryBreakdown,
  formatIssueSummary,
  getBrandIconUrl,
  getScoreLabel,
} from "@/lib/discord-lint-report";
import { getScanningUser } from "@/lib/discord-scanning-user";
import { deleteUploadedZip } from "@/lib/uploaded-zip-storage";
import {
  type LintMetadata,
  lintMetadata,
  lintPayload,
} from "@/lib/validation/lint";
import {
  createEmptyLintReport,
  createSqlfluffLockedConfigContents,
  MAX_DIRECTORY_DEPTH,
  MAX_PROJECT_FILES,
  resolvePythonExecutable,
  runLintPipeline,
  SQLFLUFF_BATCH_SIZE,
  SQLFLUFF_CONCURRENCY,
  SQLFLUFF_LOCKED_CONFIG_CONTENTS,
  TASK_QUEUE_CONCURRENCY,
  UserFacingLintFailure,
} from "@/trigger/lintPipeline";
import { resolveMacroAllowlist } from "@/trigger/macroResolution";

type ScanStatus = "processing" | "passed" | "failed";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
// These limits keep untrusted uploads bounded before CPU-heavy linting starts.
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 10_000;
// Cap declared uncompressed zip contents before extraction to reject zip bombs before they hit disk.
const MAX_TOTAL_UNCOMPRESSED_BYTES = readPositiveIntegerEnv(
  "DBT_LINT_MAX_TOTAL_UNCOMPRESSED_BYTES",
  300 * 1024 * 1024,
);
const METADATA_UPDATE_INTERVAL_MS = 1_500;
const METADATA_UPDATE_FILE_STEP = 25;

function readPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function elapsedMilliseconds(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

async function measurePhase<T>(
  timings: Record<string, number>,
  phase: string,
  operation: () => Promise<T> | T,
) {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    timings[phase] = elapsedMilliseconds(startedAt);
  }
}

function updateLintMetadata(lintData: LintMetadata) {
  const lintResult = lintMetadata.safeParse(lintData);
  if (lintResult.error) {
    console.error(lintResult.error);
    return;
  }

  const { data } = lintResult;
  metadata.set("Lint", JSON.parse(JSON.stringify(data)));
}

async function failScan({
  scanId,
  statusMessage,
  report = createEmptyLintReport(statusMessage),
}: {
  scanId: string;
  statusMessage: string;
  report?: LintReportJson;
}) {
  updateLintMetadata({
    statusMessage,
    status: "FAILED",
    progress: 100,
    report,
  });

  await finalizeScan({
    scanId,
    status: "failed",
    score: report.score,
    errors: report.totals.errors,
    warnings: report.totals.warnings,
    report,
  });

  return report;
}

function ensureWithinLimit(value: number, limit: number, label: string) {
  if (value > limit) {
    throw new UserFacingLintFailure(
      `${label} exceeds the limit of ${limit.toLocaleString()}`,
    );
  }
}

function isPathInside(parentDirectory: string, targetPath: string) {
  const relativePath = path.relative(parentDirectory, targetPath);
  return (
    relativePath === "" ||
    (relativePath.length > 0 &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath))
  );
}

function validateZipEntries(zip: AdmZip, extractedDirectory: string) {
  const resolvedExtractedDirectory = path.resolve(extractedDirectory);
  const entries = zip.getEntries();
  let totalUncompressedBytes = 0;

  ensureWithinLimit(entries.length, MAX_ZIP_ENTRIES, "Zip entry count");

  for (const entry of entries) {
    totalUncompressedBytes += entry.header.size;
    ensureWithinLimit(
      totalUncompressedBytes,
      MAX_TOTAL_UNCOMPRESSED_BYTES,
      "Total uncompressed zip size",
    );

    const entryTargetPath = path.resolve(
      resolvedExtractedDirectory,
      entry.entryName.replace(/\\/g, "/"),
    );

    if (!isPathInside(resolvedExtractedDirectory, entryTargetPath)) {
      throw new UserFacingLintFailure(
        `Unsafe zip entry path rejected: ${entry.entryName}`,
      );
    }
  }
}

function shouldQuarantineUserControlledConfigFile(fileName: string) {
  return [
    ".sqlfluff",
    "pyproject.toml",
    "tox.ini",
    "setup.cfg",
    "dbt_project.yml",
    "profiles.yml",
  ].includes(fileName);
}

function disabledConfigPath(filePath: string) {
  let candidatePath = `${filePath}.dbtlint-disabled`;
  let suffix = 1;

  while (existsSync(candidatePath)) {
    candidatePath = `${filePath}.dbtlint-disabled-${suffix}`;
    suffix += 1;
  }

  return candidatePath;
}

function quarantineUserControlledSqlfluffConfigFiles(
  directory: string,
  depth = 0,
): string[] {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new UserFacingLintFailure(
      `Project directory nesting exceeds the limit of ${MAX_DIRECTORY_DEPTH}`,
    );
  }

  const quarantinedConfigFiles: string[] = [];
  const directoryContent = readdirSync(directory, { withFileTypes: true });

  for (const asset of directoryContent) {
    const assetPath = path.join(directory, asset.name);
    const assetStats = lstatSync(assetPath);

    if (assetStats.isSymbolicLink()) continue;

    if (assetStats.isDirectory()) {
      quarantinedConfigFiles.push(
        ...quarantineUserControlledSqlfluffConfigFiles(assetPath, depth + 1),
      );
      continue;
    }

    if (shouldQuarantineUserControlledConfigFile(asset.name)) {
      renameSync(assetPath, disabledConfigPath(assetPath));
      quarantinedConfigFiles.push(assetPath);
    }
  }

  return quarantinedConfigFiles;
}

function countProjectFiles(directory: string, depth = 0): number {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new UserFacingLintFailure(
      `Project directory nesting exceeds the limit of ${MAX_DIRECTORY_DEPTH}`,
    );
  }

  let fileCount = 0;
  const directoryContent = readdirSync(directory, { withFileTypes: true });
  for (const asset of directoryContent) {
    const assetPath = path.join(directory, asset.name);
    const assetStats = lstatSync(assetPath);

    if (assetStats.isSymbolicLink()) continue;

    if (assetStats.isDirectory()) {
      fileCount += countProjectFiles(assetPath, depth + 1);
    } else {
      fileCount += 1;
    }
  }

  return fileCount;
}

function getScanDetailsUrl(scanId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  try {
    return new URL(
      `/projects/${encodeURIComponent(scanId)}`,
      siteUrl,
    ).toString();
  } catch {
    console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL");
    return undefined;
  }
}

function getScanBadgeUrl(scanId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  try {
    return new URL(
      `/api/scans/${encodeURIComponent(scanId)}/badge`,
      siteUrl,
    ).toString();
  } catch {
    console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL");
    return undefined;
  }
}

async function updateScanStatus(scanId: string, status: ScanStatus) {
  const updatedScans = await db
    .update(scans)
    .set({ status })
    .where(eq(scans.scanId, scanId))
    .returning({ id: scans.id });

  if (updatedScans.length === 0) {
    console.warn(`No scan found for scan id: ${scanId}`);
  }
}

async function finalizeScan({
  scanId,
  status,
  score,
  errors,
  warnings,
  report,
}: {
  scanId: string;
  status: Extract<ScanStatus, "passed" | "failed">;
  score: number;
  errors: number;
  warnings: number;
  report: LintReportJson;
}) {
  const updatedScans = await db
    .update(scans)
    .set({ status, score, errors, warnings, report })
    .where(eq(scans.scanId, scanId))
    .returning({
      id: scans.id,
      project: scans.project,
      userId: scans.userId,
    });

  if (updatedScans.length === 0) {
    console.warn(`No scan found for scan id: ${scanId}`);
    return null;
  }

  return {
    project: updatedScans[0].project,
    userId: updatedScans[0].userId,
  };
}

async function notifyUserScan(scanId: string) {
  try {
    const [scan] = await db
      .select({
        id: scans.id,
        userId: scans.userId,
        notificationId: notifications.id,
      })
      .from(scans)
      .leftJoin(notifications, eq(notifications.scanId, scans.id))
      .where(eq(scans.scanId, scanId))
      .limit(1);

    if (!scan) {
      console.warn(`No scan found for scan id: ${scanId}`);
      return;
    }

    if (scan.notificationId) {
      return;
    }

    await db.insert(notifications).values({
      id: randomUUID(),
      userId: scan.userId,
      scanId: scan.id,
    });
  } catch (error) {
    console.error("Failed to create scan completion notification", {
      scanId,
      error,
    });
    Sentry.captureException(error);
  }
}

async function notifyScanComplete(scanId: string) {
  await retry.onThrow(
    async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/scans/${scanId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SCAN_COMPLETE_WEBHOOK_SECRET}`,
          },
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Scan completion webhook returned non-OK status ${response.status}: ${body}`,
        );
      }

      return response;
    },
    {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  );
}

export const scanCompletionEmailTask = task({
  id: "send-scan-completion-email",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async ({ scanId }: { scanId: string }) => {
    await notifyScanComplete(scanId);
    return { scanId, sent: true };
  },
});

export const uploadedZipCleanupTask = task({
  id: "cleanup-dbt-upload",
  retry: {
    maxAttempts: 5,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async ({ storageFilePath }: { storageFilePath: string }) => {
    await deleteUploadedZip(storageFilePath);
    return { storageFilePath, deleted: true };
  },
});

async function dispatchScanCompletionWork(scanId: string) {
  const results = await Promise.allSettled([
    notifyUserScan(scanId),
    scanCompletionEmailTask.trigger({ scanId }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to dispatch scan completion work", {
        scanId,
        error: result.reason,
      });
      Sentry.captureException(result.reason);
    }
  }
}

export const dbtLintTask = schemaTask({
  id: "dbt-lint",
  schema: lintPayload,
  machine: {
    preset: "small-2x", // was implicitly "small-1x" (the default)
  },
  // Keep total task fan-out bounded; raise this only if the worker has enough CPU for concurrent sqlfluff runs.
  queue: {
    concurrencyLimit: TASK_QUEUE_CONCURRENCY,
  },
  run: async ({ scanId, storageFilePath, dialect }) => {
    const taskStartedAt = performance.now();
    const timings: Record<string, number> = {};
    let sqlFileCount = 0;
    let sqlBatchCount = 0;
    // Creates a temporary directory: temp/scan/123
    const tmpDirectory = path.join(os.tmpdir(), "scan", scanId);
    const zipFilePath = path.join(tmpDirectory, "dbt-project.zip");
    const extractedDirectory = path.join(tmpDirectory, "extracted.zip");
    const lockedConfigPath = path.join(tmpDirectory, "sqlfluff.locked.ini");

    try {
      await measurePhase(timings, "initialScanUpdateMs", () =>
        updateScanStatus(scanId, "processing"),
      );

      updateLintMetadata({
        statusMessage: "Downloading files...",
        status: "PROCESSING",
        progress: 5,
      });
      mkdirSync(tmpDirectory, { recursive: true });
      writeFileSync(lockedConfigPath, SQLFLUFF_LOCKED_CONFIG_CONTENTS, "utf8");
      const pythonExecutable = await measurePhase(
        timings,
        "pythonResolutionMs",
        resolvePythonExecutable,
      );

      const { data: storageFile, error: storageDownloadError } =
        await measurePhase(timings, "storageDownloadMs", () =>
          supabase.storage.from("dbt-uploads").download(storageFilePath),
        );

      if (storageDownloadError || !storageFile) {
        throw new Error(
          `Failed to download supabase storage file: ${storageDownloadError}`,
        );
      }

      const buffer = await measurePhase(timings, "downloadBufferMs", async () =>
        Buffer.from(await storageFile.arrayBuffer()),
      );
      ensureWithinLimit(buffer.byteLength, MAX_ZIP_BYTES, "Zip file size");

      await measurePhase(timings, "zipExtractionMs", () => {
        writeFileSync(zipFilePath, buffer);
        const zip = new AdmZip(zipFilePath);
        validateZipEntries(zip, extractedDirectory);
        zip.extractAllTo(extractedDirectory);
      });

      updateLintMetadata({
        statusMessage: "Extracting files from the zip...",
        status: "PROCESSING",
        progress: 15,
      });

      const ignoredConfigFiles = await measurePhase(
        timings,
        "projectValidationMs",
        () => {
          const projectFileCount = countProjectFiles(extractedDirectory);
          ensureWithinLimit(
            projectFileCount,
            MAX_PROJECT_FILES,
            "Project file count",
          );
          return quarantineUserControlledSqlfluffConfigFiles(
            extractedDirectory,
          );
        },
      );
      if (ignoredConfigFiles.length > 0) {
        console.warn("Ignoring user-controlled sqlfluff/dbt config files", {
          scanId,
          files: ignoredConfigFiles.map((filePath) =>
            path
              .relative(extractedDirectory, filePath)
              .split(path.sep)
              .join("/"),
          ),
        });
      }

      updateLintMetadata({
        statusMessage: "Installing dbt packages...",
        status: "PROCESSING",
        progress: 18,
      });
      // Keep the untrusted dbt_project.yml quarantined. Parse bounded package
      // manifests for allowlisting and explicitly load bounded project-local
      // macros into the locked Jinja templater config.
      const macroResolution = await measurePhase(
        timings,
        "macroResolutionMs",
        () => resolveMacroAllowlist(extractedDirectory, MAX_DIRECTORY_DEPTH),
      );
      if (macroResolution.warnings.length > 0) {
        console.warn("dbt macro resolution completed with reduced awareness", {
          scanId,
          warnings: macroResolution.warnings,
        });
      }
      console.log("Resolved dbt macro variables", {
        scanId,
        manifests: macroResolution.manifestPaths.map((filePath) =>
          path.relative(extractedDirectory, filePath).split(path.sep).join("/"),
        ),
        localMacroFiles: macroResolution.localMacroPaths.map((filePath) =>
          path.relative(extractedDirectory, filePath).split(path.sep).join("/"),
        ),
        namespaces: Array.from(macroResolution.namespaces),
        localMacros: Array.from(macroResolution.localMacros),
      });
      writeFileSync(
        lockedConfigPath,
        createSqlfluffLockedConfigContents(macroResolution.localMacroPaths),
        "utf8",
      );

      updateLintMetadata({
        statusMessage: "Starting lint...",
        status: "PROCESSING",
        progress: 20,
      });
      let lastMetadataUpdateAt = 0;
      let lastMetadataUpdateFileCount = 0;
      const lintResult = await runLintPipeline({
        rootDirectory: extractedDirectory,
        dialect,
        lockedConfigPath,
        pythonExecutable,
        allowedMacroVariables: macroResolution.allowedVariables,
        onPhaseComplete: (phase, durationMs) => {
          timings[phase] = durationMs;
        },
        onProgress: ({ filePath, lintedFiles, totalFiles }) => {
          const now = Date.now();
          const shouldUpdate =
            lintedFiles === totalFiles ||
            now - lastMetadataUpdateAt >= METADATA_UPDATE_INTERVAL_MS ||
            lintedFiles - lastMetadataUpdateFileCount >=
              METADATA_UPDATE_FILE_STEP;
          if (!shouldUpdate) return;
          lastMetadataUpdateAt = now;
          lastMetadataUpdateFileCount = lintedFiles;
          updateLintMetadata({
            statusMessage: `Linting ${path.basename(filePath)}`,
            status: "PROCESSING",
            progress: 20 + Math.floor((lintedFiles / totalFiles) * 75),
          });
        },
      });
      const { report } = lintResult;
      sqlFileCount = lintResult.sqlFileCount;
      sqlBatchCount = lintResult.sqlBatchCount;

      const finalStatus = report.totals.errors === 0 ? "PASSED" : "FAILED";

      updateLintMetadata({
        statusMessage:
          finalStatus === "PASSED"
            ? "dbt project lint passed"
            : "dbt project lint failed",
        status: finalStatus,
        progress: 100,
        report,
      });

      const finalizedScan = await measurePhase(
        timings,
        "finalScanUpdateMs",
        () =>
          finalizeScan({
            scanId,
            status: finalStatus === "PASSED" ? "passed" : "failed",
            score: report.score,
            errors: report.totals.errors,
            warnings: report.totals.warnings,
            report,
          }),
      );

      const displayProjectName = finalizedScan?.project ?? "dbt project";
      const scanDetailsUrl = getScanDetailsUrl(scanId);
      const scanBadgeUrl = getScanBadgeUrl(scanId);
      const scanningUser = finalizedScan
        ? await measurePhase(timings, "scanAuthorLookupMs", () =>
            getScanningUser(finalizedScan.userId),
          )
        : null;
      const scanningUserName =
        scanningUser?.fullName?.trim() || scanningUser?.email;

      await sendDiscordAlert({
        author: scanningUserName
          ? {
              name: scanningUserName,
              iconUrl: scanningUser?.avatarUrl ?? undefined,
            }
          : undefined,
        title:
          finalStatus === "PASSED"
            ? `✅ ${displayProjectName} passed`
            : `⚠️ ${displayProjectName} needs attention`,
        description: formatIssueSummary(
          report.totals.errors,
          report.totals.warnings,
        ),
        level: finalStatus === "PASSED" ? "success" : "warning",
        url: scanDetailsUrl,
        imageUrl: scanBadgeUrl,
        fields: [
          {
            name: "Score",
            value: `**${report.score}/100 — ${getScoreLabel(report.score)}**`,
          },
          {
            name: "Errors",
            value: report.totals.errors.toString(),
            inline: true,
          },
          {
            name: "Warnings",
            value: report.totals.warnings.toString(),
            inline: true,
          },
          {
            name: "Issues by category",
            value: formatCategoryBreakdown(report.categories),
          },
          ...(scanDetailsUrl
            ? [
                {
                  name: "Full results",
                  value: `[View scan details](${scanDetailsUrl})`,
                },
              ]
            : []),
        ],
        footer: `Technical reference · Scan ID: ${scanId}`,
        footerIconUrl: getBrandIconUrl(),
      });

      await measurePhase(timings, "completionDispatchMs", () =>
        dispatchScanCompletionWork(scanId),
      );

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown dbt lint error";
      console.log(error);
      if (error instanceof UserFacingLintFailure) {
        return failScan({
          scanId,
          statusMessage: errorMessage,
          report: error.report,
        });
      }

      Sentry.captureException(error);
      updateLintMetadata({
        statusMessage: errorMessage,
        status: "FAILED",
        progress: 100,
      });
      await updateScanStatus(scanId, "failed");
      throw error;
    } finally {
      const localCleanupStartedAt = performance.now();
      rmSync(tmpDirectory, { recursive: true, force: true });
      timings.localCleanupMs = elapsedMilliseconds(localCleanupStartedAt);

      const storageCleanupDispatchStartedAt = performance.now();
      try {
        await uploadedZipCleanupTask.trigger({ storageFilePath });
      } catch (dispatchError) {
        console.error("Failed to dispatch uploaded zip cleanup task", {
          storageFilePath,
          error: dispatchError,
        });
        Sentry.captureException(dispatchError);

        try {
          await deleteUploadedZip(storageFilePath);
        } catch (cleanupError) {
          console.error("Fallback uploaded zip cleanup failed", {
            storageFilePath,
            error: cleanupError,
          });
          Sentry.captureException(cleanupError);
        }
      } finally {
        timings.storageCleanupDispatchMs = elapsedMilliseconds(
          storageCleanupDispatchStartedAt,
        );
        const totalTaskMs = elapsedMilliseconds(taskStartedAt);
        const measuredPhaseMs =
          Math.round(
            Object.values(timings).reduce((total, value) => total + value, 0) *
              100,
          ) / 100;
        console.log(
          JSON.stringify({
            event: "dbt_lint_task_timing",
            scanId,
            sqlFileCount,
            sqlBatchCount,
            sqlfluffBatchSize: SQLFLUFF_BATCH_SIZE,
            sqlfluffConcurrency: SQLFLUFF_CONCURRENCY,
            machinePreset: "small-2x",
            ...timings,
            measuredPhaseMs,
            unmeasuredOverheadMs:
              Math.round((totalTaskMs - measuredPhaseMs) * 100) / 100,
            totalTaskMs,
          }),
        );
      }
    }
  },
});
