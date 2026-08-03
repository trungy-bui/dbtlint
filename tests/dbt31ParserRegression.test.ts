import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createSqlfluffLockedConfigContents,
  runLintPipeline,
  SQLFLUFF_LOCKED_CONFIG_CONTENTS,
} from "../trigger/lintPipeline";
import { resolveMacroAllowlist } from "../trigger/macroResolution";

const fixtureRoot = path.resolve("test-fixtures/dbt-31");
const emissionPath = path.join(
  fixtureRoot,
  "models/staging/stg_energy_emission.sql",
);
const expectedHashes = new Map([
  [
    "models/staging/stg_energy_consumption.sql",
    "3282030bb01ab77a7c8a3c33ab6f481711a7a27785e3476a4709249e0a7c3df8",
  ],
  [
    "models/staging/stg_energy_emission.sql",
    "3cda63e4326787692e7b785c2b12ed7dac164f4f6ee4c5566b818e1bd1a5c0ad",
  ],
  [
    "models/staging/stg_energy_intermediate.sql",
    "abaf53bbc597b70f63c82170de72c69c6e5fc1cc960f5c29bf0fa2c8f3880e8b",
  ],
  [
    "macros/format_int.sql",
    "82becba6db522e3353d583cf2bd8e4873ef970cea1afe4cff0fbbe967c6f93e0",
  ],
  [
    "macros/round_currency.sql",
    "d1229dad16a21330cc6c20f7495fd5fac3fdace387f400bb07f3a00968f3d6f3",
  ],
]);

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parserViolations(
  report: Awaited<ReturnType<typeof runLintPipeline>>["report"],
  filePath: string,
) {
  const file = report.categories.models.files.find(
    (candidate) => candidate.filePath === filePath,
  );
  assert.ok(file, `missing lint result for ${filePath}`);
  return file.violations.filter(({ code }) => code === "PRS");
}

test("DBT-31 fixture preserves the production artifact bytes and encoding", () => {
  for (const [relativePath, expectedHash] of expectedHashes) {
    assert.equal(sha256(path.join(fixtureRoot, relativePath)), expectedHash);
  }

  const bytes = readFileSync(emissionPath);
  assert.notDeepEqual(Array.from(bytes.subarray(0, 3)), [0xef, 0xbb, 0xbf]);
  assert.equal(bytes.includes(Buffer.from("\r\n")), false);

  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  assert.match(source, /^ {8}e\."Pays" {12}AS country$/m);
  assert.match(source, /^ {8}e\."Filière" {9}AS energy_type$/m);
  assert.match(source, /SELECT \*\nFROM cleaned/);
});

test("locked SQLFluff config loads the bounded project macro files", () => {
  const resolution = resolveMacroAllowlist(fixtureRoot, 20);
  const config = createSqlfluffLockedConfigContents(resolution.localMacroPaths);

  assert.match(config, /load_macros_from_path = /);
  assert.match(config, /macros\/format_int\.sql/);
  assert.match(config, /macros\/round_currency\.sql/);
});

test(
  "production PRS path distinguishes real SQL errors from unloaded macros",
  { skip: process.env.RUN_SQLFLUFF_INTEGRATION !== "1" },
  async () => {
    const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "dbt-31-prs-"));
    const projectRoot = path.join(temporaryRoot, "project");
    const baselineConfigPath = path.join(temporaryRoot, "baseline.ini");
    const fixedConfigPath = path.join(temporaryRoot, "fixed.ini");
    cpSync(fixtureRoot, projectRoot, { recursive: true });

    try {
      const pythonExecutable =
        process.env.DBT_LINT_PYTHON_EXECUTABLE ?? "python";
      const resolution = resolveMacroAllowlist(projectRoot, 20);
      writeFileSync(
        baselineConfigPath,
        SQLFLUFF_LOCKED_CONFIG_CONTENTS,
        "utf8",
      );
      writeFileSync(
        fixedConfigPath,
        createSqlfluffLockedConfigContents(resolution.localMacroPaths),
        "utf8",
      );

      const baseline = await runLintPipeline({
        rootDirectory: projectRoot,
        dialect: "snowflake",
        lockedConfigPath: baselineConfigPath,
        pythonExecutable,
        allowedMacroVariables: resolution.allowedVariables,
      });
      assert.match(
        parserViolations(
          baseline.report,
          "models/staging/stg_energy_consumption.sql",
        )[0]?.description ?? "",
        /AS twh/,
      );

      const fixed = await runLintPipeline({
        rootDirectory: projectRoot,
        dialect: "snowflake",
        lockedConfigPath: fixedConfigPath,
        pythonExecutable,
        allowedMacroVariables: resolution.allowedVariables,
      });
      assert.deepEqual(
        parserViolations(
          fixed.report,
          "models/staging/stg_energy_consumption.sql",
        ),
        [],
      );

      const emissionPrs = parserViolations(
        fixed.report,
        "models/staging/stg_energy_emission.sql",
      );
      assert.equal(emissionPrs.length, 1);
      assert.equal(emissionPrs[0].line_no, 9);
      assert.match(emissionPrs[0].description ?? "", /e\."Pays"/);

      const intermediatePrs = parserViolations(
        fixed.report,
        "models/staging/stg_energy_intermediate.sql",
      );
      assert.equal(intermediatePrs.length, 1);
      assert.equal(intermediatePrs[0].line_no, 1);
      assert.match(
        intermediatePrs[0].description ?? "",
        /WITH source_generation/,
      );

      const correctedEmission = readFileSync(
        path.join(projectRoot, "models/staging/stg_energy_emission.sql"),
        "utf8",
      )
        .replace('AS date\n        e."Pays"', 'AS date,\n        e."Pays"')
        .replace(
          'AS country\n        e."Filière"',
          'AS country,\n        e."Filière"',
        )
        .replace(
          'AS energy_type\n        e."Valeur (Mt)"',
          'AS energy_type,\n        e."Valeur (Mt)"',
        );
      writeFileSync(
        path.join(projectRoot, "models/staging/stg_energy_emission.sql"),
        correctedEmission,
        "utf8",
      );

      const corrected = await runLintPipeline({
        rootDirectory: projectRoot,
        dialect: "snowflake",
        lockedConfigPath: fixedConfigPath,
        pythonExecutable,
        allowedMacroVariables: resolution.allowedVariables,
      });
      assert.deepEqual(
        parserViolations(
          corrected.report,
          "models/staging/stg_energy_emission.sql",
        ),
        [],
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  },
);
