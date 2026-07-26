import {
  type Dirent,
  lstatSync,
  readdirSync,
  readFileSync,
  type Stats,
} from "node:fs";
import path from "node:path";
import type { SqlfluffViolation } from "@/lib/sqlfluff-violations";

const PACKAGE_MANIFEST_NAMES = new Set(["packages.yml", "package-lock.yml"]);
const IGNORED_DIRECTORIES = new Set([".git", "dbt_packages", "target"]);
const MAX_PACKAGE_MANIFEST_BYTES = 1024 * 1024;
const MAX_LOCAL_MACRO_BYTES = 1024 * 1024;
const LOCAL_MACRO_DEFINITION = /\{%-?\s*macro\s+([a-zA-Z_][\w]*)\s*\(/gi;

const PACKAGE_NAMESPACE_ALIASES = {
  dbt_utils: ["dbt-labs/dbt_utils", "dbt_utils"],
  dbt_expectations: [
    "calogica/dbt_expectations",
    "metaplane/dbt_expectations",
    "dbt_expectations",
  ],
  codegen: ["dbt-labs/codegen", "codegen"],
  audit_helper: ["dbt-labs/audit_helper", "audit_helper"],
} as const;

export type MacroResolution = {
  manifestPaths: string[];
  localMacroPaths: string[];
  namespaces: Set<string>;
  localMacros: Set<string>;
  allowedVariables: Set<string>;
  warnings: string[];
};

function manifestScalarValues(contents: string) {
  const values: string[] = [];
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:-\s*)?(?:package|name|project-name|git)\s*:\s*(.+?)\s*$/,
    );
    if (!match) continue;
    const value = match[1]
      .replace(/\s+#.*$/, "")
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
      .toLowerCase();
    if (value) values.push(value);
  }
  return values;
}

export function parsePackageMacroNamespaces(contents: string) {
  const scalarValues = manifestScalarValues(contents);
  const namespaces = new Set<string>();

  for (const [namespace, aliases] of Object.entries(
    PACKAGE_NAMESPACE_ALIASES,
  )) {
    if (
      aliases.some((alias) =>
        scalarValues.some(
          (value) =>
            value === alias ||
            value.endsWith(`/${alias}`) ||
            value.includes(`/${alias}.git`),
        ),
      )
    ) {
      namespaces.add(namespace);
    }
  }

  return namespaces;
}

export function parseLocalMacroNames(contents: string) {
  return new Set(
    Array.from(contents.matchAll(LOCAL_MACRO_DEFINITION), (match) => match[1]),
  );
}

export function isMacroResolutionSupportPath(repoPath: string) {
  const segments = repoPath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => IGNORED_DIRECTORIES.has(segment))
  ) {
    return false;
  }

  const fileName = segments.at(-1);
  if (!fileName) return false;
  if (PACKAGE_MANIFEST_NAMES.has(fileName)) return true;

  return (
    path.posix.extname(fileName).toLowerCase() === ".sql" &&
    segments.slice(0, -1).includes("macros")
  );
}

function safeDirectoryEntries(directory: string, warnings: string[]) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    warnings.push(
      `Unable to inspect ${directory}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [] as Dirent[];
  }
}

/**
 * Reads bounded package manifests and project-local macro definitions from the
 * extracted project. Symlinks and generated dependency directories are never
 * traversed.
 */
export function resolveMacroAllowlist(
  rootDirectory: string,
  maxDepth: number,
): MacroResolution {
  const result: MacroResolution = {
    manifestPaths: [],
    localMacroPaths: [],
    namespaces: new Set(),
    localMacros: new Set(),
    allowedVariables: new Set(),
    warnings: [],
  };

  function visitLocalMacros(directory: string, depth: number) {
    if (depth > maxDepth) return;

    for (const entry of safeDirectoryEntries(directory, result.warnings)) {
      const entryPath = path.join(directory, entry.name);
      let stats: Stats;
      try {
        stats = lstatSync(entryPath);
      } catch (error) {
        result.warnings.push(
          `Unable to inspect ${entryPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        visitLocalMacros(entryPath, depth + 1);
        continue;
      }
      if (path.extname(entry.name).toLowerCase() !== ".sql") continue;

      result.localMacroPaths.push(entryPath);
      if (stats.size > MAX_LOCAL_MACRO_BYTES) {
        result.warnings.push(`Ignoring oversized dbt macro file ${entryPath}`);
        continue;
      }

      try {
        for (const macroName of parseLocalMacroNames(
          readFileSync(entryPath, "utf8"),
        )) {
          result.localMacros.add(macroName);
          result.allowedVariables.add(macroName);
        }
      } catch (error) {
        result.warnings.push(
          `Unable to parse ${entryPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  function visit(directory: string, depth: number) {
    if (depth > maxDepth) return;

    for (const entry of safeDirectoryEntries(directory, result.warnings)) {
      const entryPath = path.join(directory, entry.name);
      let stats: Stats;
      try {
        stats = lstatSync(entryPath);
      } catch (error) {
        result.warnings.push(
          `Unable to inspect ${entryPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        if (entry.name === "macros") {
          visitLocalMacros(entryPath, 0);
          continue;
        }
        visit(entryPath, depth + 1);
        continue;
      }
      if (!PACKAGE_MANIFEST_NAMES.has(entry.name)) continue;

      result.manifestPaths.push(entryPath);
      if (stats.size > MAX_PACKAGE_MANIFEST_BYTES) {
        result.warnings.push(
          `Ignoring oversized dbt package manifest ${entryPath}`,
        );
        continue;
      }

      try {
        const parsedNamespaces = parsePackageMacroNamespaces(
          readFileSync(entryPath, "utf8"),
        );
        for (const namespace of parsedNamespaces) {
          result.namespaces.add(namespace);
          result.allowedVariables.add(namespace);
        }
      } catch (error) {
        result.warnings.push(
          `Unable to parse ${entryPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  visit(path.resolve(rootDirectory), 0);
  return result;
}

export function filterAllowedMacroUndefinedVariables(
  violations: SqlfluffViolation[],
  allowedVariables: ReadonlySet<string>,
) {
  if (allowedVariables.size === 0) return violations;

  return violations.filter((violation) => {
    if (violation.code?.toUpperCase() !== "TMP") return true;
    const match = violation.description?.match(
      /undefined jinja template variable:\s*['"]([a-zA-Z_][\w]*)['"]/i,
    );
    return !match || !allowedVariables.has(match[1]);
  });
}
