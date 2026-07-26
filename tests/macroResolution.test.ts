import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runLintPipeline } from "../trigger/lintPipeline";
import {
  filterAllowedMacroUndefinedVariables,
  isMacroResolutionSupportPath,
  parseLocalMacroNames,
  parsePackageMacroNamespaces,
  resolveMacroAllowlist,
} from "../trigger/macroResolution";

const fixturesRoot = path.resolve("test-fixtures/macro-resolution");

type FixtureCase = {
  name: string;
  dialect: string;
  namespace?: "dbt_utils" | "dbt_expectations" | "codegen" | "audit_helper";
  localMacros?: readonly string[];
  modelPaths?: readonly string[];
  changedFiles?: readonly string[];
};

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
  {
    name: "project-local",
    dialect: "ansi",
    localMacros: ["format_int", "normalize_int"],
  },
  {
    name: "project-local-nested",
    dialect: "ansi",
    localMacros: ["round_number", "clamp_number"],
  },
  {
    name: "project-local-pr-sparse",
    dialect: "ansi",
    localMacros: ["format_int"],
    modelPaths: ["models/staging/stg_energy_generation.sql"],
    changedFiles: ["models/staging/stg_energy_generation.sql"],
  },
] as const satisfies readonly FixtureCase[];

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

function findFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
  });
}

function fixtureRelativePath(fixtureDirectory: string, filePath: string) {
  return path.relative(fixtureDirectory, filePath).split(path.sep).join("/");
}

function copyRelativeFiles(
  sourceDirectory: string,
  destinationDirectory: string,
  relativePaths: readonly string[],
) {
  for (const relativePath of relativePaths) {
    const source = path.join(sourceDirectory, relativePath);
    const destination = path.join(destinationDirectory, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

test("fixture inventory is complete, minimal, and fully offline", () => {
  const fixtureNames = readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(fixtureNames, fixtureCases.map(({ name }) => name).sort());

  for (const { name, ...fixture } of fixtureCases) {
    const fixtureDirectory = path.join(fixturesRoot, name);
    assert.ok(existsSync(path.join(fixtureDirectory, "dbt_project.yml")), name);
    assert.deepEqual(
      findSqlFiles(path.join(fixtureDirectory, "models")).map((filePath) =>
        fixtureRelativePath(fixtureDirectory, filePath),
      ),
      "modelPaths" in fixture
        ? Array.from(fixture.modelPaths)
        : ["models/example.sql"],
      name,
    );

    if ("namespace" in fixture) {
      assert.ok(existsSync(path.join(fixtureDirectory, "packages.yml")), name);
      assert.ok(
        findSqlFiles(
          path.join(
            fixtureDirectory,
            "dbt_packages",
            fixture.namespace,
            "macros",
          ),
        ).length > 0,
        `${name} must vendor at least one package macro stub`,
      );
    } else {
      assert.equal(
        existsSync(path.join(fixtureDirectory, "packages.yml")),
        false,
        `${name} must not need package declarations`,
      );
      assert.equal(
        findSqlFiles(path.join(fixtureDirectory, "macros")).length,
        fixture.localMacros.length,
        `${name} must contain only its local macro stubs`,
      );
    }
  }
});

test("GitHub sparse PR resolution includes unchanged project-local macros", () => {
  assert.equal(isMacroResolutionSupportPath("packages.yml"), true);
  assert.equal(
    isMacroResolutionSupportPath("nested/project/package-lock.yml"),
    true,
  );
  assert.equal(
    isMacroResolutionSupportPath("dbt_packages/dbt_utils/macros/test.sql"),
    false,
  );
  assert.equal(isMacroResolutionSupportPath("models/example.sql"), false);

  const fixture = fixtureCases.find(
    ({ name }) => name === "project-local-pr-sparse",
  );
  assert.ok(fixture && "changedFiles" in fixture);
  const fixtureDirectory = path.join(fixturesRoot, fixture.name);
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), "macro-resolution-pr-sparse-"),
  );
  const changedFileDirectory = path.join(temporaryDirectory, "changed");
  const resolutionDirectory = path.join(temporaryDirectory, "resolution");
  const formatIntFinding = {
    code: "TMP",
    description: "Undefined jinja template variable: 'format_int'",
  };

  try {
    copyRelativeFiles(
      fixtureDirectory,
      changedFileDirectory,
      fixture.changedFiles,
    );
    const sparseResolution = resolveMacroAllowlist(changedFileDirectory, 20);
    assert.deepEqual(
      filterAllowedMacroUndefinedVariables(
        [formatIntFinding],
        sparseResolution.allowedVariables,
      ),
      [formatIntFinding],
      "changed SQL alone reproduces the pre-fix false positive",
    );

    const supportPaths = findFiles(fixtureDirectory)
      .map((filePath) => fixtureRelativePath(fixtureDirectory, filePath))
      .filter(isMacroResolutionSupportPath);
    assert.deepEqual(supportPaths, ["macros/format_int.sql"]);
    copyRelativeFiles(fixtureDirectory, resolutionDirectory, supportPaths);

    const hydratedResolution = resolveMacroAllowlist(resolutionDirectory, 20);
    assert.deepEqual(hydratedResolution.localMacros, new Set(["format_int"]));
    assert.deepEqual(
      filterAllowedMacroUndefinedVariables(
        [formatIntFinding],
        hydratedResolution.allowedVariables,
      ),
      [],
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("declared package macros produce no false undefined-variable findings", () => {
  for (const fixture of fixtureCases) {
    if (!("namespace" in fixture)) continue;
    const { name, namespace } = fixture;
    const fixtureDirectory = path.join(fixturesRoot, name);
    const resolution = resolveMacroAllowlist(fixtureDirectory, 20);
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
      filterAllowedMacroUndefinedVariables(
        simulatedSqlfluffFindings,
        resolution.allowedVariables,
      ),
      [],
      name,
    );
  }
});

test("project-local macros produce no false undefined-variable findings", () => {
  const fixture = fixtureCases.find(({ name }) => name === "project-local");
  assert.ok(fixture && "localMacros" in fixture);
  const fixtureDirectory = path.join(fixturesRoot, fixture.name);
  const resolution = resolveMacroAllowlist(fixtureDirectory, 20);

  assert.equal(resolution.warnings.length, 0);
  assert.deepEqual(resolution.manifestPaths, []);
  assert.equal(resolution.localMacroPaths.length, fixture.localMacros.length);
  assert.deepEqual(resolution.namespaces, new Set());
  assert.deepEqual(resolution.localMacros, new Set(fixture.localMacros));
  assert.deepEqual(resolution.allowedVariables, new Set(fixture.localMacros));

  const modelSource = readSqlFiles(path.join(fixtureDirectory, "models"));
  const macroSource = readSqlFiles(path.join(fixtureDirectory, "macros"));
  assert.match(modelSource, /\bformat_int\(/);
  assert.match(macroSource, /\bnormalize_int\(/);
  assert.deepEqual(
    parseLocalMacroNames(macroSource),
    new Set(fixture.localMacros),
  );

  const simulatedSqlfluffFindings = [
    {
      code: "TMP",
      description: "Undefined jinja template variable: 'format_int'",
    },
    {
      code: "TMP",
      description: "Undefined jinja template variable: 'normalize_int'",
    },
  ];
  assert.deepEqual(
    filterAllowedMacroUndefinedVariables(
      simulatedSqlfluffFindings,
      resolution.allowedVariables,
    ),
    [],
  );
});

test("project-local macros resolve at every depth below macros", () => {
  const fixture = fixtureCases.find(
    ({ name }) => name === "project-local-nested",
  );
  assert.ok(fixture && "localMacros" in fixture);
  const fixtureDirectory = path.join(fixturesRoot, fixture.name);

  // maxDepth limits project discovery, not traversal within a discovered
  // macros directory.
  const resolution = resolveMacroAllowlist(fixtureDirectory, 0);
  const relativeMacroPaths = resolution.localMacroPaths
    .map((filePath) => fixtureRelativePath(fixtureDirectory, filePath))
    .sort();

  assert.equal(resolution.warnings.length, 0);
  assert.deepEqual(relativeMacroPaths, [
    "macros/helpers/numeric/clamp_number.sql",
    "macros/utils/round_number.sql",
  ]);
  assert.deepEqual(resolution.localMacros, new Set(fixture.localMacros));
  assert.deepEqual(resolution.allowedVariables, new Set(fixture.localMacros));

  const modelSource = readSqlFiles(path.join(fixtureDirectory, "models"));
  for (const macroName of fixture.localMacros) {
    assert.match(modelSource, new RegExp(`\\b${macroName}\\(`));
  }

  const simulatedSqlfluffFindings = fixture.localMacros.map((macroName) => ({
    code: "TMP",
    description: `Undefined jinja template variable: '${macroName}'`,
  }));
  assert.deepEqual(
    filterAllowedMacroUndefinedVariables(
      simulatedSqlfluffFindings,
      resolution.allowedVariables,
    ),
    [],
  );
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
    filterAllowedMacroUndefinedVariables(violations, new Set(["dbt_utils"])),
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
  "SQLFluff reports zero macro undefined-variable findings across fixtures",
  { skip: process.env.RUN_SQLFLUFF_INTEGRATION !== "1" },
  () => {
    const pythonExecutable = process.env.DBT_LINT_PYTHON_EXECUTABLE ?? "python";

    for (const fixture of fixtureCases) {
      const { name, dialect } = fixture;
      const fixtureDirectory = path.join(fixturesRoot, name);
      const resolution = resolveMacroAllowlist(fixtureDirectory, 20);
      const modelFiles = findSqlFiles(path.join(fixtureDirectory, "models"));
      const localMacroFiles =
        "localMacros" in fixture
          ? findSqlFiles(path.join(fixtureDirectory, "macros"))
          : [];
      const lint = spawnSync(
        pythonExecutable,
        [
          "-m",
          "sqlfluff",
          "lint",
          ...modelFiles,
          ...localMacroFiles,
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
        filterAllowedMacroUndefinedVariables(
          undefinedFindings,
          resolution.allowedVariables,
        ),
        [],
        name,
      );
    }
  },
);

test(
  "GitHub sparse PR lint reports no undefined format_int finding",
  { skip: process.env.RUN_SQLFLUFF_INTEGRATION !== "1" },
  async () => {
    const fixture = fixtureCases.find(
      ({ name }) => name === "project-local-pr-sparse",
    );
    assert.ok(fixture && "changedFiles" in fixture);
    const fixtureDirectory = path.join(fixturesRoot, fixture.name);
    const temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), "macro-resolution-pr-pipeline-"),
    );
    const changedFileDirectory = path.join(temporaryDirectory, "changed");
    const resolutionDirectory = path.join(temporaryDirectory, "resolution");

    try {
      copyRelativeFiles(
        fixtureDirectory,
        changedFileDirectory,
        fixture.changedFiles,
      );
      const supportPaths = findFiles(fixtureDirectory)
        .map((filePath) => fixtureRelativePath(fixtureDirectory, filePath))
        .filter(isMacroResolutionSupportPath);
      copyRelativeFiles(fixtureDirectory, resolutionDirectory, supportPaths);
      const resolution = resolveMacroAllowlist(resolutionDirectory, 20);
      const { report } = await runLintPipeline({
        rootDirectory: changedFileDirectory,
        dialect: fixture.dialect,
        lockedConfigPath: path.resolve(
          "test-fixtures/macro-resolution/.sqlfluff",
        ),
        pythonExecutable: process.env.DBT_LINT_PYTHON_EXECUTABLE ?? "python",
        allowedMacroVariables: resolution.allowedVariables,
      });
      const undefinedFindings = report.categories.models.files.flatMap((file) =>
        file.violations.filter((finding) =>
          /undefined jinja template variable/i.test(finding.description ?? ""),
        ),
      );

      assert.deepEqual(undefinedFindings, []);
      assert.deepEqual(
        report.categories.models.files.map(({ filePath }) => filePath),
        fixture.changedFiles,
      );
      assert.equal(report.categories.macros.files.length, 0);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  },
);
