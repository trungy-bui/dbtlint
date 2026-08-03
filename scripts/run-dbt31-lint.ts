import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSqlfluffLockedConfigContents,
  runLintPipeline,
} from "../trigger/lintPipeline";
import { resolveMacroAllowlist } from "../trigger/macroResolution";

async function main() {
  const projectRoot = path.resolve("test-fixtures/dbt-31");
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "dbt-31-lint-"));
  const lockedConfigPath = path.join(temporaryRoot, "sqlfluff.locked.ini");

  try {
    const macroResolution = resolveMacroAllowlist(projectRoot, 20);
    writeFileSync(
      lockedConfigPath,
      createSqlfluffLockedConfigContents(macroResolution.localMacroPaths),
      "utf8",
    );

    const { report } = await runLintPipeline({
      rootDirectory: projectRoot,
      dialect: "snowflake",
      lockedConfigPath,
      pythonExecutable: process.env.DBT_LINT_PYTHON_EXECUTABLE,
      allowedMacroVariables: macroResolution.allowedVariables,
    });

    console.log("DBT-31 lint report");
    for (const category of Object.values(report.categories)) {
      for (const file of category.files) {
        console.log(
          `${file.filePath}: ${file.errors} error(s), ${file.warnings} warning(s)`,
        );
        for (const violation of file.violations) {
          console.log(
            `  ${violation.line_no ?? "-"}:${violation.line_pos ?? "-"} ${violation.code ?? "-"} ${violation.description ?? ""}`,
          );
        }
      }
    }
    console.log(
      `TOTAL files=${report.totals.files} errors=${report.totals.errors} warnings=${report.totals.warnings} score=${report.score}`,
    );
    process.exitCode = report.totals.errors === 0 ? 0 : 1;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

void main();
