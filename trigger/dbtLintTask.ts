import { execFile } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { metadata, schemaTask } from "@trigger.dev/sdk";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import db from "@/db";
import { type LintReportJson, scans } from "@/db/schema";
import {
  type LintMetadata,
  lintMetadata,
  lintPayload,
} from "@/lib/validation/lint";

type ScanStatus = "processing" | "passed" | "failed";
type DbtFolder = "models" | "tests" | "macros";
type LintCategoryReport = LintReportJson["categories"][DbtFolder];

type SqlfluffViolation = {
  code?: string;
  description?: string;
  line_no?: number;
  line_pos?: number;
  [key: string]: unknown;
};

type FileLintResult = {
  filePath: string;
  errors: number;
  warnings: number;
  violations: SqlfluffViolation[];
};

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
const execFileAsync = promisify(execFile);

const DBT_FOLDERS = ["models", "tests", "macros"] as const;

// These limits keep untrusted uploads bounded before CPU-heavy linting starts.
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 10_000;
// Cap declared uncompressed zip contents before extraction to reject zip bombs before they hit disk.
const MAX_TOTAL_UNCOMPRESSED_BYTES = readPositiveIntegerEnv(
  "DBT_LINT_MAX_TOTAL_UNCOMPRESSED_BYTES",
  300 * 1024 * 1024,
);
// Counts every extracted file, including non-SQL, to reject archives stuffed with irrelevant files.
const MAX_PROJECT_FILES = 5_000;
// Counts only SQL files that sqlfluff will process, bounding the actual lint workload.
const MAX_SQL_FILES = 1_000;
const MAX_TOTAL_SQL_LINES = 200_000;
const MAX_DIRECTORY_DEPTH = 20;

// sqlfluff is CPU-bound and may invoke templating; keep both per-file and task-level fan-out bounded.
const SQLFLUFF_TIMEOUT_MS = 60_000;
const SQLFLUFF_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const SQLFLUFF_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_SQLFLUFF_CONCURRENCY",
  6,
);
const TASK_QUEUE_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_TASK_QUEUE_CONCURRENCY",
  2,
);
const METADATA_UPDATE_INTERVAL_MS = 1_500;
const METADATA_UPDATE_FILE_STEP = 25;

class UserFacingLintFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingLintFailure";
  }
}

type ExecFileFailure = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  signal?: NodeJS.Signals | string;
};

function readPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function createEmptyReport(statusMessage?: string): LintReportJson {
  const createCategory = (folder: DbtFolder): LintCategoryReport => ({
    folderPath: null,
    files: [],
    skipped: true,
    statusMessage: statusMessage ?? `No ${folder} folder found in dbt project`,
  });

  return {
    categories: {
      models: createCategory("models"),
      tests: createCategory("tests"),
      macros: createCategory("macros"),
    },
    totals: {
      files: 0,
      lines: 0,
      errors: 0,
      warnings: 0,
    },
    score: 0,
  };
}

async function failScan({
  scanId,
  statusMessage,
  report = createEmptyReport(statusMessage),
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

function countLines(filePath: string) {
  const content = readFileSync(filePath, "utf8");
  if (!content) return 0;

  return content.split(/\r\n|\r|\n/).length;
}

function isErrorViolation(violation: SqlfluffViolation) {
  const code = violation.code?.toUpperCase() ?? "";
  return code.startsWith("PRS") || code.startsWith("TMP");
}

function parseSqlfluffOutput(output: string): SqlfluffViolation[] {
  const parsed = JSON.parse(output) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("sqlfluff returned JSON in an unexpected shape");
  }

  return parsed.flatMap((fileResult) => {
    if (
      typeof fileResult !== "object" ||
      fileResult === null ||
      !Array.isArray((fileResult as { violations?: unknown }).violations)
    ) {
      return [];
    }

    return (fileResult as { violations: SqlfluffViolation[] }).violations;
  });
}

function calculateScore({
  errors,
  warnings,
  totalFiles,
}: {
  errors: number;
  warnings: number;
  totalFiles: number;
}) {
  if (totalFiles === 0) return 0;

  const ERROR_WEIGHT = 15;
  const WARNING_WEIGHT = 3;

  const avgErrorsPerFile = errors / totalFiles;
  const avgWarningsPerFile = warnings / totalFiles;

  const penalty =
    avgErrorsPerFile * ERROR_WEIGHT + avgWarningsPerFile * WARNING_WEIGHT;

  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
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
    .returning({ id: scans.id });

  if (updatedScans.length === 0) {
    console.warn(`No scan found for scan id: ${scanId}`);
  }
}

async function notifyScanComplete(scanId: string) {
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/scans/${scanId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SCAN_COMPLETE_WEBHOOK_SECRET}`,
        },
      },
    );
  } catch (error) {
    console.error("Failed to call scan completion email webhook", {
      scanId,
      error,
    });
  }
}

async function lintSqlFile(filePath: string, dialect: string) {
  try {
    const { stdout } = await execFileAsync(
      "python",
      [
        "-m",
        "sqlfluff",
        "lint",
        filePath,
        "--format",
        "json",
        "--dialect",
        dialect,
      ],
      {
        maxBuffer: SQLFLUFF_MAX_BUFFER_BYTES,
        timeout: SQLFLUFF_TIMEOUT_MS,
        windowsHide: true,
      },
    );

    return parseSqlfluffOutput(stdout);
  } catch (error) {
    const execError = error as ExecFileFailure;

    if (typeof execError.stdout === "string" && execError.stdout.trim()) {
      try {
        return parseSqlfluffOutput(execError.stdout);
      } catch (parseError) {
        return [
          createSqlfluffExecutionViolation(
            `sqlfluff produced non-JSON output for ${path.basename(filePath)}: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
          ),
        ];
      }
    }

    return [
      createSqlfluffExecutionViolation(
        `Failed to run sqlfluff for ${path.basename(filePath)}: ${
          execError.killed || execError.signal === "SIGTERM"
            ? `timed out after ${SQLFLUFF_TIMEOUT_MS / 1000} seconds`
            : execError.stderr?.trim() || execError.message || String(error)
        }`,
        execError.killed || execError.signal === "SIGTERM"
          ? "TMP_TIMEOUT"
          : "TMP_EXEC_ERROR",
      ),
    ];
  }
}

function createSqlfluffExecutionViolation(
  description: string,
  code = "TMP_EXEC_ERROR",
): SqlfluffViolation {
  return {
    code,
    description,
    line_no: 1,
    line_pos: 1,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await runNext();
    }),
  );

  return results;
}

function createProgressUpdater(totalFiles: number) {
  let lastMetadataUpdateAt = 0;
  let lastMetadataUpdateFileCount = 0;

  return (lintedFiles: number, filePath: string) => {
    const now = Date.now();
    const shouldUpdate =
      lintedFiles === 0 ||
      lintedFiles === totalFiles ||
      now - lastMetadataUpdateAt >= METADATA_UPDATE_INTERVAL_MS ||
      lintedFiles - lastMetadataUpdateFileCount >= METADATA_UPDATE_FILE_STEP;

    if (!shouldUpdate) return;

    lastMetadataUpdateAt = now;
    lastMetadataUpdateFileCount = lintedFiles;

    updateLintMetadata({
      statusMessage: `Linting ${path.basename(filePath)}`,
      status: "PROCESSING",
      progress: 20 + Math.floor((lintedFiles / totalFiles) * 75),
    });
  };
}

async function lintFilesWithConcurrency({
  files,
  dialect,
  extractedDirectory,
  onFileLinted,
}: {
  files: string[];
  dialect: string;
  extractedDirectory: string;
  onFileLinted: (filePath: string) => void;
}) {
  return mapWithConcurrency(files, SQLFLUFF_CONCURRENCY, async (filePath) => {
    const violations = await lintSqlFile(filePath, dialect);
    const errors = violations.filter(isErrorViolation).length;
    const warnings = violations.length - errors;

    onFileLinted(filePath);

    return {
      filePath: path
        .relative(extractedDirectory, filePath)
        .split(path.sep)
        .join("/"),
      errors,
      warnings,
      violations,
    };
  });
}

function folderInDirectory(
  directory: string,
  folder: DbtFolder,
  depth = 0,
): string | null {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new UserFacingLintFailure(
      `Project directory nesting exceeds the limit of ${MAX_DIRECTORY_DEPTH}`,
    );
  }

  const directoryContent = readdirSync(directory, { withFileTypes: true });
  if (
    directoryContent.some(
      (entry) => entry.isDirectory() && entry.name === folder,
    )
  ) {
    return path.join(directory, folder);
  }

  for (const nestedDirectory of directoryContent) {
    const nestedPath = path.join(directory, nestedDirectory.name);
    const nestedStats = lstatSync(nestedPath);

    if (nestedStats.isSymbolicLink()) continue;

    if (nestedStats.isDirectory()) {
      const nestedContent = folderInDirectory(nestedPath, folder, depth + 1);
      if (nestedContent) return nestedContent;
    }
  }

  return null;
}

function readDirectoryContent(directory: string, depth = 0) {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new UserFacingLintFailure(
      `Project directory nesting exceeds the limit of ${MAX_DIRECTORY_DEPTH}`,
    );
  }

  const directoryFiles: Array<string> = [];
  const directoryContent = readdirSync(directory, { withFileTypes: true });
  for (const asset of directoryContent) {
    const assetPath = path.join(directory, asset.name);
    const assetStats = lstatSync(assetPath);

    if (assetStats.isSymbolicLink()) continue;

    if (assetStats.isDirectory()) {
      directoryFiles.push(...readDirectoryContent(assetPath, depth + 1));
    } else if (path.extname(assetPath) === ".sql") {
      directoryFiles.push(assetPath);
    }
  }
  return directoryFiles;
}

export const dbtLintTask = schemaTask({
  id: "dbt-lint",
  schema: lintPayload,
  // Keep total task fan-out bounded; raise this only if the worker has enough CPU for concurrent sqlfluff runs.
  queue: {
    concurrencyLimit: TASK_QUEUE_CONCURRENCY,
  },
  run: async ({ scanId, storageFilePath, dialect }) => {
    // Creates a temporary directory: temp/scan/123
    const tmpDirectory = path.join(os.tmpdir(), "scan", scanId);
    const zipFilePath = path.join(tmpDirectory, "dbt-project.zip");
    const extractedDirectory = path.join(tmpDirectory, "extracted.zip");

    try {
      await updateScanStatus(scanId, "processing");

      updateLintMetadata({
        statusMessage: "Downloading files...",
        status: "PROCESSING",
        progress: 5,
      });
      mkdirSync(tmpDirectory, { recursive: true });

      const { data: storageFile, error: storageDownloadError } =
        await supabase.storage.from("dbt-uploads").download(storageFilePath);

      if (storageDownloadError || !storageFile) {
        throw new Error(
          `Failed to download supabase storage file: ${storageDownloadError}`,
        );
      }

      const buffer = Buffer.from(await storageFile.arrayBuffer());
      ensureWithinLimit(buffer.byteLength, MAX_ZIP_BYTES, "Zip file size");

      writeFileSync(zipFilePath, buffer);

      const zip = new AdmZip(zipFilePath);
      validateZipEntries(zip, extractedDirectory);
      zip.extractAllTo(extractedDirectory);

      updateLintMetadata({
        statusMessage: "Extracting files from the zip...",
        status: "PROCESSING",
        progress: 15,
      });

      const projectFileCount = countProjectFiles(extractedDirectory);
      ensureWithinLimit(
        projectFileCount,
        MAX_PROJECT_FILES,
        "Project file count",
      );

      const { models, tests, macros } = Object.fromEntries(
        DBT_FOLDERS.map((folder) => [
          folder,
          folderInDirectory(extractedDirectory, folder),
        ]),
      ) as Record<DbtFolder, string | null>;

      const report = {
        categories: {
          models: {
            folderPath: models,
            files: [] as FileLintResult[],
            skipped: !models,
            statusMessage: models
              ? undefined
              : "No models folder found in dbt project",
          },
          tests: {
            folderPath: tests,
            files: [] as FileLintResult[],
            skipped: !tests,
            statusMessage: tests
              ? undefined
              : "No tests folder found in dbt project",
          },
          macros: {
            folderPath: macros,
            files: [] as FileLintResult[],
            skipped: !macros,
            statusMessage: macros
              ? undefined
              : "No macros folder found in dbt project",
          },
        },
        totals: {
          files: 0,
          lines: 0,
          errors: 0,
          warnings: 0,
        },
        score: 0,
      };

      const filesByCategory = Object.entries({ models, tests, macros }).reduce(
        (acc, [category, folderPath]) => {
          acc[category as DbtFolder] = folderPath
            ? readDirectoryContent(folderPath)
            : [];
          return acc;
        },
        {} as Record<DbtFolder, string[]>,
      );

      const allFiles = Object.values(filesByCategory).flat();
      report.totals.files = allFiles.length;
      if (report.totals.files > MAX_SQL_FILES) {
        return failScan({
          scanId,
          statusMessage: `SQL file count exceeds the limit of ${MAX_SQL_FILES.toLocaleString()}`,
          report,
        });
      }

      report.totals.lines = allFiles.reduce(
        (total, filePath) => total + countLines(filePath),
        0,
      );
      if (report.totals.lines > MAX_TOTAL_SQL_LINES) {
        return failScan({
          scanId,
          statusMessage: `Total SQL lines exceed the limit of ${MAX_TOTAL_SQL_LINES.toLocaleString()}`,
          report,
        });
      }

      if (allFiles.length === 0) {
        return failScan({
          scanId,
          statusMessage: "No SQL files found to lint",
          report,
        });
      }

      let lintedFiles = 0;
      const updateProgress = createProgressUpdater(allFiles.length);
      updateLintMetadata({
        statusMessage: "Starting lint...",
        status: "PROCESSING",
        progress: 20,
      });

      for (const category of DBT_FOLDERS) {
        const categoryResults = await lintFilesWithConcurrency({
          files: filesByCategory[category],
          dialect,
          extractedDirectory,
          onFileLinted: (filePath) => {
            lintedFiles += 1;
            updateProgress(lintedFiles, filePath);
          },
        });

        report.categories[category].files.push(...categoryResults);
        report.totals.errors += categoryResults.reduce(
          (total, result) => total + result.errors,
          0,
        );
        report.totals.warnings += categoryResults.reduce(
          (total, result) => total + result.warnings,
          0,
        );
      }

      report.score = calculateScore({
        errors: report.totals.errors,
        warnings: report.totals.warnings,
        totalFiles: report.totals.files,
      });

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

      await finalizeScan({
        scanId,
        status: finalStatus === "PASSED" ? "passed" : "failed",
        score: report.score,
        errors: report.totals.errors,
        warnings: report.totals.warnings,
        report,
      });

      await notifyScanComplete(scanId);

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown dbt lint error";
      console.log(error);
      if (error instanceof UserFacingLintFailure) {
        return failScan({ scanId, statusMessage: errorMessage });
      }

      updateLintMetadata({
        statusMessage: errorMessage,
        status: "FAILED",
        progress: 100,
      });
      await updateScanStatus(scanId, "failed");
      throw error;
    } finally {
      rmSync(tmpDirectory, { recursive: true, force: true });

      try {
        const { error: deleteError } = await supabase.storage
          .from("dbt-uploads")
          .remove([storageFilePath]);

        if (deleteError) {
          console.error("Failed to delete uploaded zip from storage", {
            storageFilePath,
            error: deleteError,
          });
        }
      } catch (cleanupError) {
        console.error("Unexpected error deleting uploaded zip from storage", {
          storageFilePath,
          error: cleanupError,
        });
        Sentry.captureException(cleanupError);
      }
    }
  },
});
