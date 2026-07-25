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

export type PackageMacroResolution = {
  manifestPaths: string[];
  namespaces: Set<string>;
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
 * Reads only bounded package manifests from the extracted project. Symlinks and
 * generated dependency directories are never traversed.
 */
export function resolvePackageMacroAllowlist(
  rootDirectory: string,
  maxDepth: number,
): PackageMacroResolution {
  const result: PackageMacroResolution = {
    manifestPaths: [],
    namespaces: new Set(),
    warnings: [],
  };

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
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          visit(entryPath, depth + 1);
        }
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

export function filterAllowedPackageUndefinedVariables(
  violations: SqlfluffViolation[],
  packageMacroNamespaces: ReadonlySet<string>,
) {
  if (packageMacroNamespaces.size === 0) return violations;

  return violations.filter((violation) => {
    if (violation.code?.toUpperCase() !== "TMP") return true;
    const match = violation.description?.match(
      /undefined jinja template variable:\s*['"]([a-zA-Z_][\w]*)['"]/i,
    );
    return !match || !packageMacroNamespaces.has(match[1]);
  });
}
