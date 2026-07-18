import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify, TextDecoder } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { metadata, retry, schemaTask, task } from "@trigger.dev/sdk";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import db from "@/db";
import { type LintReportJson, notifications, scans } from "@/db/schema";
import { captureExceptionWithDiscord } from "@/lib/sentry-alert";
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

type LineCountResult = {
  lineCount: number;
  readError: string | null;
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
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

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

// sqlfluff is CPU-bound and may invoke templating; keep both per-batch and task-level fan-out bounded.
const SQLFLUFF_TIMEOUT_MS = 60_000;
const SQLFLUFF_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const SQLFLUFF_LOCKED_CONFIG_CONTENTS = `[sqlfluff]
templater = jinja
`;
const SQLFLUFF_BATCH_SIZE = readPositiveIntegerEnv(
  "DBT_LINT_SQLFLUFF_BATCH_SIZE",
  40,
);
const SQLFLUFF_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_SQLFLUFF_CONCURRENCY",
  1,
);
// Global cap on concurrent lint jobs across all users. Tune this against the
// Trigger.dev machine preset's CPU/memory before raising it for real traffic.
const TASK_QUEUE_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_TASK_QUEUE_CONCURRENCY",
  4,
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

const SQLFLUFF_SUBPROCESS_ENV = Object.fromEntries(
  [
    ["NODE_ENV", process.env.NODE_ENV ?? "production"],
    ["HOME", process.env.HOME ?? "/tmp"],
    ["LANG", process.env.LANG ?? "C.UTF-8"],
    ["LC_ALL", process.env.LC_ALL ?? "C.UTF-8"],
    ["PYTHONUTF8", "1"],
    ["LOCALAPPDATA", process.env.LOCALAPPDATA],
    ["PATH", process.env.PATH],
    ["Path", process.env.Path],
    ["SystemRoot", process.env.SystemRoot],
    ["WINDIR", process.env.WINDIR],
    ["PATHEXT", process.env.PATHEXT],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
) as NodeJS.ProcessEnv;
let hasLoggedSqlfluffConfigPath = false;
let hasLoggedSqlfluffPythonExecutable = false;
let hasWarnedAboutPathBasedPythonDiscovery = false;
let resolvedPythonExecutablePromise: Promise<string> | null = null;

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

function countLines(filePath: string): LineCountResult {
  let content: string;
  try {
    content = UTF8_DECODER.decode(readFileSync(filePath));
  } catch (error) {
    return {
      lineCount: 0,
      readError: error instanceof Error ? error.message : String(error),
    };
  }

  if (!content) {
    return {
      lineCount: 0,
      readError: null,
    };
  }

  return {
    lineCount: content.split(/\r\n|\r|\n/).length,
    readError: null,
  };
}

function isErrorViolation(violation: SqlfluffViolation) {
  const code = violation.code?.toUpperCase() ?? "";
  return code.startsWith("PRS") || code.startsWith("TMP");
}

function parseSqlfluffOutput(
  output: string,
): { filePath: string | null; violations: SqlfluffViolation[] }[] {
  const parsed = JSON.parse(output) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("sqlfluff returned JSON in an unexpected shape");
  }

  return parsed.map((fileResult) => {
    if (
      typeof fileResult !== "object" ||
      fileResult === null ||
      !Array.isArray((fileResult as { violations?: unknown }).violations)
    ) {
      return { filePath: null, violations: [] };
    }

    const result = fileResult as {
      filepath?: unknown;
      violations: SqlfluffViolation[];
    };

    return {
      filePath: typeof result.filepath === "string" ? result.filepath : null,
      violations: result.violations,
    };
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
    await captureExceptionWithDiscord({
      error,
      title: "Scan notification creation failed",
      context: { task: "dbt-lint", scanId },
    });
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

function chunkFiles(files: string[], chunkSize: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < files.length; index += chunkSize) {
    chunks.push(files.slice(index, index + chunkSize));
  }
  return chunks;
}

function normalizeSqlfluffFilePath(filePath: string) {
  return path.resolve(filePath);
}

function mapSqlfluffOutputToFiles(
  output: string,
  files: string[],
): Map<string, SqlfluffViolation[]> {
  const violationsByFile = new Map(
    files.map((filePath) => [
      normalizeSqlfluffFilePath(filePath),
      [] as SqlfluffViolation[],
    ]),
  );

  for (const fileResult of parseSqlfluffOutput(output)) {
    if (!fileResult.filePath) continue;

    const normalizedFilePath = normalizeSqlfluffFilePath(fileResult.filePath);
    if (violationsByFile.has(normalizedFilePath)) {
      violationsByFile.set(normalizedFilePath, fileResult.violations);
    }
  }

  return violationsByFile;
}

function createBatchExecutionViolations(
  files: string[],
  descriptionForFile: (filePath: string) => string,
  code = "TMP_EXEC_ERROR",
) {
  return new Map(
    files.map((filePath) => [
      normalizeSqlfluffFilePath(filePath),
      [createSqlfluffExecutionViolation(descriptionForFile(filePath), code)],
    ]),
  );
}

type PythonExecutableCandidate = {
  command: string;
  args: string[];
  source: string;
};

function truncateSubprocessOutput(output: string | undefined) {
  return output?.trim().slice(0, 500) || "(empty)";
}

async function validatePythonExecutableCandidate({
  command,
  args,
  source,
}: PythonExecutableCandidate) {
  await execFileAsync(command, [...args, "-m", "sqlfluff", "--version"], {
    env: SQLFLUFF_SUBPROCESS_ENV,
    timeout: 15_000,
    windowsHide: true,
  });

  const executablePathScript =
    "import os, sys; print(os.path.abspath(sys.executable))";

  const { stdout } = await execFileAsync(
    command,
    [...args, "-c", executablePathScript],
    {
      env: SQLFLUFF_SUBPROCESS_ENV,
      timeout: 15_000,
      windowsHide: true,
    },
  );
  const executablePath = stdout.trim().split(/\r?\n/).at(-1)?.trim();

  if (!executablePath || !path.isAbsolute(executablePath)) {
    throw new Error(
      `${source} resolved to a non-absolute Python path: ${executablePath || "(empty)"}`,
    );
  }

  return executablePath;
}

async function resolvePythonExecutable() {
  if (resolvedPythonExecutablePromise) return resolvedPythonExecutablePromise;

  resolvedPythonExecutablePromise = (async () => {
    const configuredPythonExecutable =
      process.env.PYTHON_EXECUTABLE ?? process.env.PYTHON_BIN_PATH;
    if (
      configuredPythonExecutable &&
      path.isAbsolute(configuredPythonExecutable)
    ) {
      if (!hasLoggedSqlfluffPythonExecutable) {
        hasLoggedSqlfluffPythonExecutable = true;
        console.log("Using configured Python executable for sqlfluff", {
          pythonExecutable: configuredPythonExecutable,
          resolvedFrom: process.env.PYTHON_EXECUTABLE
            ? "PYTHON_EXECUTABLE"
            : "Trigger.dev PYTHON_BIN_PATH",
          validationSkipped: true,
        });
      }
      return configuredPythonExecutable;
    }

    const candidates: PythonExecutableCandidate[] = [];
    if (process.env.PYTHON_EXECUTABLE) {
      candidates.push({
        command: process.env.PYTHON_EXECUTABLE,
        args: [],
        source: "PYTHON_EXECUTABLE",
      });
    }

    if (process.env.PYTHON_BIN_PATH) {
      candidates.push({
        command: process.env.PYTHON_BIN_PATH,
        args: [],
        source: "Trigger.dev PYTHON_BIN_PATH",
      });
    }

    if (candidates.length === 0 && !hasWarnedAboutPathBasedPythonDiscovery) {
      hasWarnedAboutPathBasedPythonDiscovery = true;
      console.warn(
        "No PYTHON_EXECUTABLE or PYTHON_BIN_PATH set. Falling back to PATH-based Python discovery, which is not guaranteed deterministic.",
      );
    }

    candidates.push(
      { command: "python", args: [], source: "python on PATH" },
      { command: "python3", args: [], source: "python3 on PATH" },
    );

    if (process.platform === "win32") {
      candidates.push({
        command: "py",
        args: ["-3"],
        source: "Windows py launcher",
      });
    }

    const failures: string[] = [];
    for (const candidate of candidates) {
      try {
        const executablePath =
          await validatePythonExecutableCandidate(candidate);
        if (!hasLoggedSqlfluffPythonExecutable) {
          hasLoggedSqlfluffPythonExecutable = true;
          console.log("Using Python executable for sqlfluff", {
            pythonExecutable: executablePath,
            resolvedFrom: candidate.source,
            platform: process.platform,
            localAppDataIncluded:
              typeof SQLFLUFF_SUBPROCESS_ENV.LOCALAPPDATA === "string",
          });
        }
        return executablePath;
      } catch (error) {
        const execError = error as ExecFileFailure;
        console.warn("Rejected Python executable candidate for sqlfluff", {
          source: candidate.source,
          command: candidate.command,
          args: candidate.args,
          error: error instanceof Error ? error.message : String(error),
          stdout: truncateSubprocessOutput(execError.stdout),
          stderr: truncateSubprocessOutput(execError.stderr),
        });
        failures.push(
          `${candidate.source} (${candidate.command} ${candidate.args.join(" ")}): ${
            error instanceof Error ? error.message : String(error)
          }; stdout=${truncateSubprocessOutput(execError.stdout)}; stderr=${truncateSubprocessOutput(
            execError.stderr,
          )}`,
        );
      }
    }

    throw new Error(
      `Unable to resolve a Python executable with sqlfluff importable. Set PYTHON_EXECUTABLE to an absolute interpreter path. Attempts: ${failures.join(" | ")}`,
    );
  })();

  return resolvedPythonExecutablePromise;
}

function logSqlfluffSubprocessOutput({
  stdout,
  stderr,
  parseError,
}: {
  stdout?: string;
  stderr?: string;
  parseError?: unknown;
}) {
  if (stdout?.trim()) {
    console.error("sqlfluff produced non-JSON stdout", {
      parseError: parseError instanceof Error ? parseError.message : parseError,
      stdout: stdout.slice(0, 500),
    });
  }

  if (stderr?.trim()) {
    console.error("sqlfluff subprocess stderr", {
      stderr: stderr.slice(0, 500),
    });
  }
}

async function lintSqlFiles(
  files: string[],
  dialect: string,
  lockedConfigPath: string,
  pythonExecutable: string,
) {
  try {
    if (!hasLoggedSqlfluffConfigPath) {
      hasLoggedSqlfluffConfigPath = true;
      console.log("Using locked sqlfluff config", {
        configPath: lockedConfigPath,
        configPathExists: existsSync(lockedConfigPath),
      });
    }

    // This subprocess processes untrusted Jinja-bearing SQL and must never inherit
    // network credentials or app secrets such as Supabase keys.
    const { stdout } = await execFileAsync(
      pythonExecutable,
      [
        "-m",
        "sqlfluff",
        "lint",
        ...files,
        "--format",
        "json",
        "--dialect",
        dialect,
        "--templater",
        "jinja",
        "--config",
        lockedConfigPath,
      ],
      {
        env: SQLFLUFF_SUBPROCESS_ENV,
        maxBuffer: SQLFLUFF_MAX_BUFFER_BYTES,
        timeout: SQLFLUFF_TIMEOUT_MS,
        windowsHide: true,
      },
    );

    return mapSqlfluffOutputToFiles(stdout, files);
  } catch (error) {
    const execError = error as ExecFileFailure;

    if (typeof execError.stdout === "string" && execError.stdout.trim()) {
      try {
        return mapSqlfluffOutputToFiles(execError.stdout, files);
      } catch (parseError) {
        logSqlfluffSubprocessOutput({
          stdout: execError.stdout,
          stderr: execError.stderr,
          parseError,
        });
        return createBatchExecutionViolations(files, (filePath) => {
          return `sqlfluff produced non-JSON output for ${path.basename(filePath)}: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`;
        });
      }
    }

    logSqlfluffSubprocessOutput({
      stderr: execError.stderr,
    });

    return createBatchExecutionViolations(
      files,
      (filePath) =>
        `Failed to run sqlfluff for ${path.basename(filePath)}: ${
          execError.killed || execError.signal === "SIGTERM"
            ? `timed out after ${SQLFLUFF_TIMEOUT_MS / 1000} seconds`
            : execError.stderr?.trim() || execError.message || String(error)
        }`,
      execError.killed || execError.signal === "SIGTERM"
        ? "TMP_TIMEOUT"
        : "TMP_EXEC_ERROR",
    );
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

function toReportFilePath(extractedDirectory: string, filePath: string) {
  return path.relative(extractedDirectory, filePath).split(path.sep).join("/");
}

function createUnreadableSqlFileResult({
  filePath,
  extractedDirectory,
  readError,
}: {
  filePath: string;
  extractedDirectory: string;
  readError: string;
}): FileLintResult {
  const violations = [
    createSqlfluffExecutionViolation(
      `Failed to read SQL file as UTF-8 text for ${path.basename(filePath)}: ${readError}`,
      "TMP_FILE_READ_ERROR",
    ),
  ];

  return {
    filePath: toReportFilePath(extractedDirectory, filePath),
    errors: violations.filter(isErrorViolation).length,
    warnings: 0,
    violations,
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
  lockedConfigPath,
  pythonExecutable,
  extractedDirectory,
  onFileLinted,
}: {
  files: string[];
  dialect: string;
  lockedConfigPath: string;
  pythonExecutable: string;
  extractedDirectory: string;
  onFileLinted: (filePath: string) => void;
}) {
  const batches = chunkFiles(files, SQLFLUFF_BATCH_SIZE);
  const batchResults = await mapWithConcurrency(
    batches,
    SQLFLUFF_CONCURRENCY,
    async (batch) => {
      const violationsByFile = await lintSqlFiles(
        batch,
        dialect,
        lockedConfigPath,
        pythonExecutable,
      );

      return batch.map((filePath) => {
        const violations =
          violationsByFile.get(normalizeSqlfluffFilePath(filePath)) ?? [];
        const errors = violations.filter(isErrorViolation).length;
        const warnings = violations.length - errors;

        onFileLinted(filePath);

        return {
          filePath: toReportFilePath(extractedDirectory, filePath),
          errors,
          warnings,
          violations,
        };
      });
    },
  );

  return batchResults.flat();
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

async function deleteUploadedZip(storageFilePath: string) {
  const { error } = await supabase.storage
    .from("dbt-uploads")
    .remove([storageFilePath]);

  if (error) {
    throw new Error(`Failed to delete uploaded zip: ${error.message}`);
  }
}

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
      await captureExceptionWithDiscord({
        error: result.reason,
        title: "Scan completion dispatch failed",
        context: { task: "dbt-lint", scanId },
      });
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

      const { models, tests, macros } = await measurePhase(
        timings,
        "folderDiscoveryMs",
        () =>
          Object.fromEntries(
            DBT_FOLDERS.map((folder) => [
              folder,
              folderInDirectory(extractedDirectory, folder),
            ]),
          ) as Record<DbtFolder, string | null>,
      );

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
      sqlFileCount = allFiles.length;
      sqlBatchCount = Math.ceil(sqlFileCount / SQLFLUFF_BATCH_SIZE);
      report.totals.files = allFiles.length;
      if (report.totals.files > MAX_SQL_FILES) {
        return failScan({
          scanId,
          statusMessage: `SQL file count exceeds the limit of ${MAX_SQL_FILES.toLocaleString()}`,
          report,
        });
      }

      const lineCountsByFile = await measurePhase(
        timings,
        "lineCountingMs",
        () =>
          new Map(allFiles.map((filePath) => [filePath, countLines(filePath)])),
      );
      report.totals.lines = Array.from(lineCountsByFile.values()).reduce(
        (total, result) => total + result.lineCount,
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

      // Lint one global batch stream so small models/tests/macros directories do
      // not each pay for a separate Python/sqlfluff process startup.
      const lintableFiles = allFiles.filter(
        (filePath) => !lineCountsByFile.get(filePath)?.readError,
      );
      const lintedResults = await measurePhase(timings, "sqlfluffLintMs", () =>
        lintFilesWithConcurrency({
          files: lintableFiles,
          dialect,
          lockedConfigPath,
          pythonExecutable,
          extractedDirectory,
          onFileLinted: (filePath) => {
            lintedFiles += 1;
            updateProgress(lintedFiles, filePath);
          },
        }),
      );
      const lintedResultsByPath = new Map(
        lintedResults.map((result) => [result.filePath, result]),
      );

      for (const category of DBT_FOLDERS) {
        const categoryFiles = filesByCategory[category];
        const categoryResults = categoryFiles.map((filePath) => {
          const lineCountResult = lineCountsByFile.get(filePath);
          if (lineCountResult?.readError) {
            const result = createUnreadableSqlFileResult({
              filePath,
              extractedDirectory,
              readError: lineCountResult.readError,
            });
            lintedFiles += 1;
            updateProgress(lintedFiles, filePath);
            return result;
          }

          const result = lintedResultsByPath.get(
            toReportFilePath(extractedDirectory, filePath),
          );
          if (!result) {
            throw new Error(`Missing lint result for ${filePath}`);
          }
          return result;
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

      await measurePhase(timings, "finalScanUpdateMs", () =>
        finalizeScan({
          scanId,
          status: finalStatus === "PASSED" ? "passed" : "failed",
          score: report.score,
          errors: report.totals.errors,
          warnings: report.totals.warnings,
          report,
        }),
      );

      await measurePhase(timings, "completionDispatchMs", () =>
        dispatchScanCompletionWork(scanId),
      );

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown dbt lint error";
      console.log(error);
      if (error instanceof UserFacingLintFailure) {
        return failScan({ scanId, statusMessage: errorMessage });
      }

      await captureExceptionWithDiscord({
        error,
        title: "dbt lint task failed",
        context: { task: "dbt-lint", scanId },
      });
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
        await captureExceptionWithDiscord({
          error: dispatchError,
          title: "Uploaded ZIP cleanup dispatch failed",
          context: { task: "dbt-lint", scanId, storageFilePath },
        });

        try {
          await deleteUploadedZip(storageFilePath);
        } catch (cleanupError) {
          console.error("Fallback uploaded zip cleanup failed", {
            storageFilePath,
            error: cleanupError,
          });
          await captureExceptionWithDiscord({
            error: cleanupError,
            title: "Uploaded ZIP fallback cleanup failed",
            context: { task: "dbt-lint", scanId, storageFilePath },
          });
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
