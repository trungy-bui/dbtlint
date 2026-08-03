import { execFile } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify, TextDecoder } from "node:util";
import type { LintReportJson } from "@/db/schema";
import { attachDeterministicFix } from "@/lib/autofix";
import {
  attachSourceLineToViolation,
  isErrorSqlfluffViolation,
  normalizeSqlfluffViolation,
  type SqlfluffViolation,
} from "@/lib/sqlfluff-violations";
import {
  filterAllowedMacroUndefinedVariables,
  resolveMacroAllowlist,
} from "@/trigger/macroResolution";

export const DBT_FOLDERS = ["models", "tests", "macros"] as const;
export type DbtFolder = (typeof DBT_FOLDERS)[number];

export const MAX_PROJECT_FILES = 5_000;
export const MAX_SQL_FILES = 1_000;
export const MAX_TOTAL_SQL_LINES = 200_000;
export const MAX_DIRECTORY_DEPTH = 20;
export const SQLFLUFF_LOCKED_CONFIG_CONTENTS = `[sqlfluff]
templater = jinja
ignore = parsing

[sqlfluff:templater:jinja]
apply_dbt_builtins = True
`;

export function createSqlfluffLockedConfigContents(
  localMacroPaths: readonly string[] = [],
) {
  if (localMacroPaths.length === 0) return SQLFLUFF_LOCKED_CONFIG_CONTENTS;

  const serializedPaths = localMacroPaths.map((macroPath) => {
    const absolutePath = path.resolve(macroPath);
    if (/[,\r\n]/.test(absolutePath)) {
      throw new UserFacingLintFailure(
        `Project macro path cannot be represented safely in the locked SQLFluff config: ${absolutePath}`,
      );
    }
    return absolutePath.replace(/\\/g, "/");
  });

  return `${SQLFLUFF_LOCKED_CONFIG_CONTENTS}load_macros_from_path = ${serializedPaths.join(",")}\n`;
}

const SQLFLUFF_TIMEOUT_MS = 60_000;
const SQLFLUFF_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
export const SQLFLUFF_BATCH_SIZE = readPositiveIntegerEnv(
  "DBT_LINT_SQLFLUFF_BATCH_SIZE",
  40,
);
export const SQLFLUFF_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_SQLFLUFF_CONCURRENCY",
  1,
);
export const TASK_QUEUE_CONCURRENCY = readPositiveIntegerEnv(
  "DBT_LINT_TASK_QUEUE_CONCURRENCY",
  4,
);

type FileLintResult = LintReportJson["categories"][DbtFolder]["files"][number];
type LineCountResult = {
  lineCount: number;
  readError: string | null;
  sourceLines: string[];
};
type ExecFileFailure = Error & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  signal?: NodeJS.Signals | string;
};
type PythonExecutableCandidate = {
  command: string;
  args: string[];
  source: string;
};

export type LintPipelineProgress = {
  filePath: string;
  lintedFiles: number;
  totalFiles: number;
};

export type LintPipelineResult = {
  report: LintReportJson;
  sqlFileCount: number;
  sqlBatchCount: number;
};

export class UserFacingLintFailure extends Error {
  constructor(
    message: string,
    readonly report?: LintReportJson,
  ) {
    super(message);
    this.name = "UserFacingLintFailure";
  }
}

const execFileAsync = promisify(execFile);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
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

export function createEmptyLintReport(statusMessage?: string): LintReportJson {
  const createCategory = (folder: DbtFolder) => ({
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
    totals: { files: 0, lines: 0, errors: 0, warnings: 0 },
    score: 0,
  };
}

function countLines(filePath: string): LineCountResult {
  let content: string;
  try {
    content = UTF8_DECODER.decode(readFileSync(filePath));
  } catch (error) {
    return {
      lineCount: 0,
      readError: error instanceof Error ? error.message : String(error),
      sourceLines: [],
    };
  }

  if (!content) return { lineCount: 0, readError: null, sourceLines: [] };
  const sourceLines = content.split(/\r\n|\r|\n/);
  return { lineCount: sourceLines.length, readError: null, sourceLines };
}

function parseSqlfluffOutput(output: string) {
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
      return { filePath: null, violations: [] as SqlfluffViolation[] };
    }

    const result = fileResult as {
      filepath?: unknown;
      violations: SqlfluffViolation[];
    };
    return {
      filePath: typeof result.filepath === "string" ? result.filepath : null,
      violations: result.violations.map(normalizeSqlfluffViolation),
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
  const penalty = (errors / totalFiles) * 15 + (warnings / totalFiles) * 3;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
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

function mapSqlfluffOutputToFiles(output: string, files: string[]) {
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

function createSqlfluffExecutionViolation(
  description: string,
  code = "TMP_EXEC_ERROR",
): SqlfluffViolation {
  return { code, description };
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
  const { stdout } = await execFileAsync(
    command,
    [...args, "-c", "import os, sys; print(os.path.abspath(sys.executable))"],
    { env: SQLFLUFF_SUBPROCESS_ENV, timeout: 15_000, windowsHide: true },
  );
  const executablePath = stdout.trim().split(/\r?\n/).at(-1)?.trim();
  if (!executablePath || !path.isAbsolute(executablePath)) {
    throw new Error(
      `${source} resolved to a non-absolute Python path: ${executablePath || "(empty)"}`,
    );
  }
  return executablePath;
}

export async function resolvePythonExecutable() {
  if (resolvedPythonExecutablePromise) return resolvedPythonExecutablePromise;

  const resolutionPromise = (async () => {
    const configured =
      process.env.PYTHON_EXECUTABLE ?? process.env.PYTHON_BIN_PATH;
    if (configured && path.isAbsolute(configured)) {
      if (!hasLoggedSqlfluffPythonExecutable) {
        hasLoggedSqlfluffPythonExecutable = true;
        console.log("Using configured Python executable for sqlfluff", {
          pythonExecutable: configured,
          resolvedFrom: process.env.PYTHON_EXECUTABLE
            ? "PYTHON_EXECUTABLE"
            : "Trigger.dev PYTHON_BIN_PATH",
          validationSkipped: true,
        });
      }
      return configured;
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
          }; stdout=${truncateSubprocessOutput(execError.stdout)}; stderr=${truncateSubprocessOutput(execError.stderr)}`,
        );
      }
    }
    throw new Error(
      `Unable to resolve a Python executable with sqlfluff importable. Set PYTHON_EXECUTABLE to an absolute interpreter path. Attempts: ${failures.join(" | ")}`,
    );
  })();
  resolvedPythonExecutablePromise = resolutionPromise;

  try {
    return await resolutionPromise;
  } catch (error) {
    if (resolvedPythonExecutablePromise === resolutionPromise) {
      resolvedPythonExecutablePromise = null;
    }
    throw error;
  }
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
        return createBatchExecutionViolations(
          files,
          (filePath) =>
            `sqlfluff produced non-JSON output for ${path.basename(filePath)}: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
        );
      }
    }
    logSqlfluffSubprocessOutput({ stderr: execError.stderr });
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

function toReportFilePath(rootDirectory: string, filePath: string) {
  return path.relative(rootDirectory, filePath).split(path.sep).join("/");
}

function createUnreadableSqlFileResult({
  filePath,
  rootDirectory,
  readError,
}: {
  filePath: string;
  rootDirectory: string;
  readError: string;
}): FileLintResult {
  const violations = [
    createSqlfluffExecutionViolation(
      `Failed to read SQL file as UTF-8 text for ${path.basename(filePath)}: ${readError}`,
      "TMP_FILE_READ_ERROR",
    ),
  ];
  return {
    filePath: toReportFilePath(rootDirectory, filePath),
    errors: violations.filter(isErrorSqlfluffViolation).length,
    warnings: 0,
    violations,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  );
  return results;
}

async function lintFilesWithConcurrency({
  files,
  dialect,
  lockedConfigPath,
  pythonExecutable,
  rootDirectory,
  sourceLinesByFile,
  onFileLinted,
  allowedMacroVariables,
}: {
  files: string[];
  dialect: string;
  lockedConfigPath: string;
  pythonExecutable: string;
  rootDirectory: string;
  sourceLinesByFile: ReadonlyMap<string, readonly string[]>;
  onFileLinted: (filePath: string) => void;
  allowedMacroVariables: ReadonlySet<string>;
}) {
  const batchResults = await mapWithConcurrency(
    chunkFiles(files, SQLFLUFF_BATCH_SIZE),
    SQLFLUFF_CONCURRENCY,
    async (batch) => {
      const violationsByFile = await lintSqlFiles(
        batch,
        dialect,
        lockedConfigPath,
        pythonExecutable,
      );
      return batch.map((filePath) => {
        const rawViolations =
          violationsByFile.get(normalizeSqlfluffFilePath(filePath)) ?? [];
        const sourceLines = sourceLinesByFile.get(filePath) ?? [];
        const violations = filterAllowedMacroUndefinedVariables(
          rawViolations.map((violation) =>
            attachDeterministicFix(
              attachSourceLineToViolation(violation, sourceLines),
              sourceLines,
            ),
          ),
          allowedMacroVariables,
        );
        const errors = violations.filter(isErrorSqlfluffViolation).length;
        onFileLinted(filePath);
        return {
          filePath: toReportFilePath(rootDirectory, filePath),
          errors,
          warnings: violations.length - errors,
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

function readDirectoryContent(directory: string, depth = 0): string[] {
  if (depth > MAX_DIRECTORY_DEPTH) {
    throw new UserFacingLintFailure(
      `Project directory nesting exceeds the limit of ${MAX_DIRECTORY_DEPTH}`,
    );
  }
  const directoryFiles: string[] = [];
  for (const asset of readdirSync(directory, { withFileTypes: true })) {
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

async function measure<T>(
  phase: string,
  operation: () => Promise<T> | T,
  onPhaseComplete?: (phase: string, durationMs: number) => void,
) {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    onPhaseComplete?.(
      phase,
      Math.round((performance.now() - startedAt) * 100) / 100,
    );
  }
}

export async function runLintPipeline({
  rootDirectory,
  dialect,
  lockedConfigPath,
  pythonExecutable,
  onProgress,
  onPhaseComplete,
  allowedMacroVariables,
}: {
  rootDirectory: string;
  dialect: string;
  lockedConfigPath: string;
  pythonExecutable?: string;
  onProgress?: (progress: LintPipelineProgress) => void;
  onPhaseComplete?: (phase: string, durationMs: number) => void;
  allowedMacroVariables?: ReadonlySet<string>;
}): Promise<LintPipelineResult> {
  const resolvedPythonExecutable =
    pythonExecutable ??
    (await measure(
      "pythonResolutionMs",
      resolvePythonExecutable,
      onPhaseComplete,
    ));
  const resolvedAllowedMacroVariables =
    allowedMacroVariables ??
    resolveMacroAllowlist(rootDirectory, MAX_DIRECTORY_DEPTH).allowedVariables;
  const folders = await measure(
    "folderDiscoveryMs",
    () =>
      Object.fromEntries(
        DBT_FOLDERS.map((folder) => [
          folder,
          folderInDirectory(rootDirectory, folder),
        ]),
      ) as Record<DbtFolder, string | null>,
    onPhaseComplete,
  );
  const report = createEmptyLintReport();
  for (const folder of DBT_FOLDERS) {
    report.categories[folder] = {
      folderPath: folders[folder],
      files: [],
      skipped: !folders[folder],
      statusMessage: folders[folder]
        ? undefined
        : `No ${folder} folder found in dbt project`,
    };
  }

  const filesByCategory = Object.fromEntries(
    DBT_FOLDERS.map((folder) => [
      folder,
      folders[folder] ? readDirectoryContent(folders[folder]) : [],
    ]),
  ) as Record<DbtFolder, string[]>;
  const allFiles = Object.values(filesByCategory).flat();
  report.totals.files = allFiles.length;
  if (allFiles.length > MAX_SQL_FILES) {
    throw new UserFacingLintFailure(
      `SQL file count exceeds the limit of ${MAX_SQL_FILES.toLocaleString()}`,
      report,
    );
  }

  const lineCountsByFile = await measure(
    "lineCountingMs",
    () => new Map(allFiles.map((filePath) => [filePath, countLines(filePath)])),
    onPhaseComplete,
  );
  report.totals.lines = Array.from(lineCountsByFile.values()).reduce(
    (total, result) => total + result.lineCount,
    0,
  );
  if (report.totals.lines > MAX_TOTAL_SQL_LINES) {
    throw new UserFacingLintFailure(
      `Total SQL lines exceed the limit of ${MAX_TOTAL_SQL_LINES.toLocaleString()}`,
      report,
    );
  }
  if (allFiles.length === 0) {
    throw new UserFacingLintFailure("No SQL files found to lint", report);
  }

  let lintedFiles = 0;
  const lintableFiles = allFiles.filter(
    (filePath) => !lineCountsByFile.get(filePath)?.readError,
  );
  const lintedResults = await measure(
    "sqlfluffLintMs",
    () =>
      lintFilesWithConcurrency({
        files: lintableFiles,
        dialect,
        lockedConfigPath,
        pythonExecutable: resolvedPythonExecutable,
        rootDirectory,
        sourceLinesByFile: new Map(
          Array.from(lineCountsByFile, ([filePath, result]) => [
            filePath,
            result.sourceLines,
          ]),
        ),
        onFileLinted: (filePath) => {
          lintedFiles += 1;
          onProgress?.({ filePath, lintedFiles, totalFiles: allFiles.length });
        },
        allowedMacroVariables: resolvedAllowedMacroVariables,
      }),
    onPhaseComplete,
  );
  const lintedResultsByPath = new Map(
    lintedResults.map((result) => [result.filePath, result]),
  );

  for (const category of DBT_FOLDERS) {
    const categoryResults = filesByCategory[category].map((filePath) => {
      const lineCountResult = lineCountsByFile.get(filePath);
      if (lineCountResult?.readError) {
        const result = createUnreadableSqlFileResult({
          filePath,
          rootDirectory,
          readError: lineCountResult.readError,
        });
        lintedFiles += 1;
        onProgress?.({ filePath, lintedFiles, totalFiles: allFiles.length });
        return result;
      }
      const result = lintedResultsByPath.get(
        toReportFilePath(rootDirectory, filePath),
      );
      if (!result) throw new Error(`Missing lint result for ${filePath}`);
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
  return {
    report,
    sqlFileCount: allFiles.length,
    sqlBatchCount: Math.ceil(allFiles.length / SQLFLUFF_BATCH_SIZE),
  };
}
