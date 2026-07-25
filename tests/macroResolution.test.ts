import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  filterAllowedPackageUndefinedVariables,
  parsePackageMacroNamespaces,
  resolvePackageMacroAllowlist,
} from "../trigger/macroResolution";

const fixturesRoot = path.resolve("test-fixtures/macro-resolution");
const expectedFixtures = new Set([
  "adapter-override",
  "audit-helper",
  "codegen",
  "dbt-expectations",
  "dbt-utils",
  "dispatch-pattern",
  "nested-call",
]);

function findSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findSqlFiles(entryPath);
    return path.extname(entry.name) === ".sql" ? [entryPath] : [];
  });
}

test("declared package macros produce no false undefined-variable findings", () => {
  const fixtureNames = readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(new Set(fixtureNames), expectedFixtures);

  for (const fixtureName of fixtureNames) {
    const fixtureDirectory = path.join(fixturesRoot, fixtureName);
    const resolution = resolvePackageMacroAllowlist(fixtureDirectory, 20);
    assert.equal(resolution.warnings.length, 0, fixtureName);
    assert.ok(resolution.manifestPaths.length > 0, fixtureName);
    assert.ok(resolution.namespaces.size > 0, fixtureName);

    const source = findSqlFiles(fixtureDirectory)
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");
    const simulatedSqlfluffFindings = Array.from(
      source.matchAll(/\b(dbt_utils|dbt_expectations|codegen|audit_helper)\./g),
      (match) => ({
        code: "TMP",
        description: `Undefined jinja template variable: '${match[1]}'`,
      }),
    );
    const remainingFindings = filterAllowedPackageUndefinedVariables(
      simulatedSqlfluffFindings,
      resolution.namespaces,
    );
    assert.deepEqual(remainingFindings, [], fixtureName);
  }
});

test("undeclared namespaces and non-undefined TMP findings are preserved", () => {
  const violations = [
    {
      code: "TMP",
      description: "Undefined jinja template variable: 'dbt_utils'",
    },
    {
      code: "TMP",
      description: "Undefined jinja template variable: 'untrusted_package'",
    },
    { code: "TMP", description: "Template parsing failed" },
  ];

  assert.deepEqual(
    filterAllowedPackageUndefinedVariables(violations, new Set(["dbt_utils"])),
    violations.slice(1),
  );
});

test("package-lock.yml entries are parsed independently", () => {
  const lockContents = readFileSync(
    path.join(fixturesRoot, "dbt-utils", "package-lock.yml"),
    "utf8",
  );
  assert.deepEqual(
    parsePackageMacroNamespaces(lockContents),
    new Set(["dbt_utils"]),
  );
});

test(
  "SQLFluff reports zero package undefined-variable findings across fixtures",
  { skip: process.env.RUN_SQLFLUFF_INTEGRATION !== "1" },
  () => {
    for (const fixtureName of expectedFixtures) {
      const fixtureDirectory = path.join(fixturesRoot, fixtureName);
      const resolution = resolvePackageMacroAllowlist(fixtureDirectory, 20);
      const sqlFiles = findSqlFiles(fixtureDirectory);
      const lint = spawnSync(
        "python",
        [
          "-m",
          "sqlfluff",
          "lint",
          ...sqlFiles,
          "--format",
          "json",
          "--dialect",
          "ansi",
          "--templater",
          "jinja",
          "--config",
          path.resolve("test-fixtures/macro-resolution/.sqlfluff"),
        ],
        { encoding: "utf8" },
      );
      assert.notEqual(
        (lint.error as NodeJS.ErrnoException | undefined)?.code,
        "ENOENT",
        lint.error?.message,
      );

      const findings = (
        JSON.parse(lint.stdout) as Array<{
          violations: Array<{ code: string; description: string }>;
        }>
      ).flatMap((result) => result.violations);
      const undefinedFindings = findings.filter((finding) =>
        /undefined jinja template variable/i.test(finding.description),
      );
      assert.deepEqual(
        filterAllowedPackageUndefinedVariables(
          undefinedFindings,
          resolution.namespaces,
        ),
        [],
        fixtureName,
      );
    }
  },
);
