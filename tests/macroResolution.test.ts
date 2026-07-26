import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  filterAllowedPackageUndefinedVariables,
  parsePackageMacroNamespaces,
  resolvePackageMacroAllowlist,
} from "../trigger/macroResolution";

const fixturesRoot = path.resolve("test-fixtures/macro-resolution");

const fixtureCases = [
  {
    name: "adapter-override-bigquery",
    namespace: "dbt_utils",
    dialect: "bigquery",
  },
  {
    name: "adapter-override-redshift",
    namespace: "dbt_utils",
    dialect: "redshift",
  },
  {
    name: "adapter-override-snowflake",
    namespace: "dbt_utils",
    dialect: "snowflake",
  },
  { name: "audit-helper", namespace: "audit_helper", dialect: "ansi" },
  { name: "codegen", namespace: "codegen", dialect: "ansi" },
  { name: "dbt-expectations", namespace: "dbt_expectations", dialect: "ansi" },
  { name: "dbt-utils", namespace: "dbt_utils", dialect: "ansi" },
  { name: "dispatch-pattern", namespace: "dbt_utils", dialect: "ansi" },
  { name: "nested-call", namespace: "dbt_utils", dialect: "ansi" },
] as const;

function findSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findSqlFiles(entryPath);
    return path.extname(entry.name) === ".sql" ? [entryPath] : [];
  });
}

function readSqlFiles(directory: string) {
  return findSqlFiles(directory)
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");
}

test("fixture inventory is complete, minimal, and fully offline", () => {
  const fixtureNames = readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(fixtureNames, fixtureCases.map(({ name }) => name).sort());

  for (const { name, namespace } of fixtureCases) {
    const fixtureDirectory = path.join(fixturesRoot, name);
    assert.ok(existsSync(path.join(fixtureDirectory, "dbt_project.yml")), name);
    assert.ok(existsSync(path.join(fixtureDirectory, "packages.yml")), name);
    assert.deepEqual(
      readdirSync(path.join(fixtureDirectory, "models")),
      ["example.sql"],
      name,
    );
    assert.ok(
      findSqlFiles(
        path.join(fixtureDirectory, "dbt_packages", namespace, "macros"),
      ).length > 0,
      `${name} must vendor at least one package macro stub`,
    );
  }
});

test("declared package macros produce no false undefined-variable findings", () => {
  for (const { name, namespace } of fixtureCases) {
    const fixtureDirectory = path.join(fixturesRoot, name);
    const resolution = resolvePackageMacroAllowlist(fixtureDirectory, 20);
    assert.equal(resolution.warnings.length, 0, name);
    assert.ok(resolution.manifestPaths.length > 0, name);
    assert.deepEqual(resolution.namespaces, new Set([namespace]), name);

    const simulatedSqlfluffFindings = Array.from(
      readSqlFiles(path.join(fixtureDirectory, "models")).matchAll(
        /\b(dbt_utils|dbt_expectations|codegen|audit_helper)\./g,
      ),
      (match) => ({
        code: "TMP",
        description: `Undefined jinja template variable: '${match[1]}'`,
      }),
    );
    assert.ok(simulatedSqlfluffFindings.length > 0, name);
    assert.deepEqual(
      filterAllowedPackageUndefinedVariables(
        simulatedSqlfluffFindings,
        resolution.namespaces,
      ),
      [],
      name,
    );
  }
});

test("specialized fixtures contain the intended resolution patterns", () => {
  const dispatchSource = readSqlFiles(
    path.join(fixturesRoot, "dispatch-pattern", "dbt_packages"),
  );
  assert.match(dispatchSource, /adapter\.dispatch\(/);

  for (const adapter of ["snowflake", "bigquery", "redshift"]) {
    const source = readSqlFiles(
      path.join(fixturesRoot, `adapter-override-${adapter}`, "dbt_packages"),
    );
    assert.match(
      source,
      new RegExp(`macro ${adapter}__generate_surrogate_key`),
    );
  }

  const nestedSource = readSqlFiles(
    path.join(fixturesRoot, "nested-call", "dbt_packages"),
  );
  const levelOne = nestedSource.indexOf("macro level_one");
  const levelTwoCall = nestedSource.indexOf("level_two(field)", levelOne);
  const levelTwo = nestedSource.indexOf("macro level_two", levelTwoCall);
  const levelThreeCall = nestedSource.indexOf("level_three(field)", levelTwo);
  const levelThree = nestedSource.indexOf("macro level_three", levelThreeCall);
  assert.ok(
    levelOne >= 0 &&
      levelTwoCall > levelOne &&
      levelTwo > levelTwoCall &&
      levelThreeCall > levelTwo &&
      levelThree > levelThreeCall,
    "nested-call must retain a three-level macro chain",
  );
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
    const pythonExecutable = process.env.DBT_LINT_PYTHON_EXECUTABLE ?? "python";

    for (const { name, dialect } of fixtureCases) {
      const fixtureDirectory = path.join(fixturesRoot, name);
      const resolution = resolvePackageMacroAllowlist(fixtureDirectory, 20);
      const modelFiles = findSqlFiles(path.join(fixtureDirectory, "models"));
      const lint = spawnSync(
        pythonExecutable,
        [
          "-m",
          "sqlfluff",
          "lint",
          ...modelFiles,
          "--format",
          "json",
          "--dialect",
          dialect,
          "--templater",
          "jinja",
          "--config",
          path.resolve("test-fixtures/macro-resolution/.sqlfluff"),
        ],
        { encoding: "utf8" },
      );

      assert.equal(lint.error, undefined, `${name}: ${lint.error?.message}`);
      assert.ok(
        lint.stdout,
        `${name}: SQLFluff returned no JSON: ${lint.stderr}`,
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
        name,
      );
    }
  },
);
