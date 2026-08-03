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
} from "../trigger/lintPipeline";
import { resolveMacroAllowlist } from "../trigger/macroResolution";

const fixtureRoot = path.resolve("test-fixtures/dbt-31");
const emissionPath = path.join(
  fixtureRoot,
  "models/staging/stg_energy_emission.sql",
);
const testModelPath = path.join(fixtureRoot, "models/staging/test.sql");
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
    "models/staging/stg_energy_generation.sql",
    "d1b4676bc371e7070e1f5a855744989c20c4cc001de3459af10eb712e9c98b86",
  ],
  [
    "models/staging/test.sql",
    "0f522ca80d70d53bf26113e279eecc76cd044c100c375ba929e2608b40a3508b",
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

function allParserViolations(
  report: Awaited<ReturnType<typeof runLintPipeline>>["report"],
) {
  return Object.values(report.categories).flatMap((category) =>
    category.files.flatMap((file) =>
      file.violations
        .filter(({ code }) => code === "PRS")
        .map((violation) => ({ filePath: file.filePath, violation })),
    ),
  );
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

  const testModel = new TextDecoder("utf-8", { fatal: true }).decode(
    readFileSync(testModelPath),
  );
  assert.match(testModel, /^ {8}e\."Pays" {12}AS country,s$/m);
  assert.match(testModel, /^ {8}e\."Filière" {9}AS energy_type,$/m);
});

test("locked SQLFluff config loads the bounded project macro files", () => {
  const resolution = resolveMacroAllowlist(fixtureRoot, 20);
  const config = createSqlfluffLockedConfigContents(resolution.localMacroPaths);

  assert.match(config, /load_macros_from_path = /);
  assert.match(config, /macros\/format_int\.sql/);
  assert.match(config, /macros\/round_currency\.sql/);
});

test(
  "production lint ignores SQLFluff parser failures for the seven-file DBT-31 project",
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
        createSqlfluffLockedConfigContents(resolution.localMacroPaths).replace(
          "ignore = parsing\n",
          "",
        ),
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
      assert.deepEqual(
        allParserViolations(baseline.report).map(({ filePath, violation }) => [
          filePath,
          violation.line_no,
          violation.description,
        ]),
        [
          [
            "models/staging/stg_energy_emission.sql",
            9,
            "Line 9, Position 9: Found unparsable section: 'e.\"Pays\"            AS country\\n        e...'",
          ],
          [
            "models/staging/stg_energy_intermediate.sql",
            1,
            "Line 1, Position 1: Found unparsable section: 'WITH source_generation AS (\\n    SELECT *...'",
          ],
          [
            "models/staging/test.sql",
            10,
            "Line 10, Position 10: Found unparsable section: '.\"Filière\"         AS energy_type,\\n     ...'",
          ],
        ],
      );

      const fixed = await runLintPipeline({
        rootDirectory: projectRoot,
        dialect: "snowflake",
        lockedConfigPath: fixedConfigPath,
        pythonExecutable,
        allowedMacroVariables: resolution.allowedVariables,
      });
      assert.equal(fixed.report.totals.files, 7);
      assert.equal(fixed.report.totals.errors, 0);
      assert.deepEqual(allParserViolations(fixed.report), []);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  },
);
