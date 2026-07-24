import assert from "node:assert/strict";
import test from "node:test";
import type { Octokit } from "@octokit/rest";
import type { LintReportJson } from "@/db/schema";
import {
  addedLinesFromPatch,
  buildCheckRunAnnotations,
  CHECK_ANNOTATION_BATCH_SIZE,
  completeCheckRun,
  formatCheckRunSummary,
  formatCheckRunText,
} from "./checks";

function createReport({
  violations,
  errors = 0,
  warnings = violations.length,
}: {
  violations: LintReportJson["categories"]["models"]["files"][number]["violations"];
  errors?: number;
  warnings?: number;
}): LintReportJson {
  return {
    categories: {
      models: {
        folderPath: "models",
        files: [
          {
            filePath: "models/orders.sql",
            errors,
            warnings,
            violations,
          },
        ],
        skipped: false,
      },
      tests: { folderPath: null, files: [], skipped: true },
      macros: { folderPath: null, files: [], skipped: true },
    },
    totals: { files: 1, lines: 120, errors, warnings },
    score: errors > 0 ? 70 : 94,
  };
}

test("extracts only added new-side line numbers from unified diff hunks", () => {
  const patch = [
    "@@ -1,2 +1,3 @@",
    " select 1",
    "+select 2",
    " select 3",
    "@@ -10 +11,2 @@",
    "-select old",
    "+select new",
    "+select another",
    "\\ No newline at end of file",
  ].join("\n");

  assert.deepEqual([...addedLinesFromPatch(patch)], [2, 11, 12]);
  assert.deepEqual([...addedLinesFromPatch(undefined)], []);
});

test("builds friendly annotations only for violations on added lines", () => {
  const report = createReport({
    errors: 1,
    warnings: 2,
    violations: [
      { code: "LT02", description: "Expected 4 spaces", line_no: 2 },
      {
        code: "PRS",
        description: "Found unparsable section: 'from'",
        line_no: 11,
        sourceLine: "select * form orders",
      },
      { code: "LT01", description: "Unexpected whitespace", line_no: 3 },
    ],
  });
  const patch = [
    "@@ -1,2 +1,3 @@",
    " select 1",
    "+select 2",
    " select 3",
    "@@ -10 +11 @@",
    "-select old",
    "+select new",
  ].join("\n");

  const annotations = buildCheckRunAnnotations(report, [
    { filename: "models/orders.sql", patch },
  ]);

  assert.equal(annotations.length, 2);
  assert.deepEqual(
    annotations.map(({ start_line, annotation_level }) => ({
      start_line,
      annotation_level,
    })),
    [
      { start_line: 2, annotation_level: "warning" },
      { start_line: 11, annotation_level: "failure" },
    ],
  );
  assert.equal(annotations[0].title, "Inconsistent indentation");
  assert.equal(annotations[0].message.includes("LT02"), false);
  assert.match(
    annotations[1].message,
    /Your SQL has a syntax error and won't run until this is fixed\./,
  );
  assert.equal(annotations[1].raw_details, "select * form orders");
  assert.equal(JSON.stringify(annotations).includes('"code"'), false);
});

test("skips all inline annotations when GitHub omits the file patch", () => {
  const report = createReport({
    violations: [
      { code: "LT02", description: "Expected 4 spaces", line_no: 2 },
    ],
  });

  assert.deepEqual(
    buildCheckRunAnnotations(report, [
      { filename: "models/orders.sql", patch: undefined },
    ]),
    [],
  );
});

test("formats errors-only check text with file, line, rule, and message", () => {
  const text = formatCheckRunText(
    createReport({
      errors: 2,
      warnings: 0,
      violations: [
        {
          code: "PRS",
          description: "Found unparsable section: 'from'",
          line_no: 11,
        },
        {
          code: "TMP_TIMEOUT",
          description: "Lint command timed out",
        },
      ],
    }),
  );

  assert.match(text, /^### Errors/);
  assert.match(
    text,
    /`models\/orders\.sql:11` — `PRS` — Found unparsable section: 'from'/,
  );
  assert.match(
    text,
    /`models\/orders\.sql` — `TMP_TIMEOUT` — Lint command timed out/,
  );
  assert.equal(text.includes("### Warnings"), false);
});

test("formats warnings-only check text with the same detail structure", () => {
  const text = formatCheckRunText(
    createReport({
      violations: [
        {
          code: "LT02",
          description: "Expected 4 spaces",
          line_no: 2,
        },
      ],
    }),
  );

  assert.equal(
    text,
    "### Warnings\n\n- `models/orders.sql:2` — `LT02` — Expected 4 spaces",
  );
});

test("formats mixed check text with errors before warnings", () => {
  const text = formatCheckRunText(
    createReport({
      errors: 1,
      warnings: 1,
      violations: [
        { code: "LT01", description: "Unexpected whitespace", line_no: 3 },
        { code: "PRS", description: "Syntax error", line_no: 8 },
      ],
    }),
  );

  assert.ok(text.indexOf("### Errors") < text.indexOf("### Warnings"));
  assert.match(text, /`PRS` — Syntax error/);
  assert.match(text, /`LT01` — Unexpected whitespace/);
});

test("truncates oversized check text with omitted severity counts", () => {
  const report = createReport({
    errors: 3,
    warnings: 2,
    violations: [
      ...Array.from({ length: 3 }, (_, index) => ({
        code: "PRS",
        description: `Error ${index} ${"x".repeat(80)}`,
        line_no: index + 1,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        code: "LT01",
        description: `Warning ${index} ${"y".repeat(80)}`,
        line_no: index + 10,
      })),
    ],
  });

  const text = formatCheckRunText(report, 260);

  assert.ok(text.length <= 260);
  assert.match(text, /\d+ more errors and \d+ more warnings truncated/);
  assert.match(text, /full DBTLint report/);
});

test("completes one check run across 50-annotation PATCH batches", async () => {
  const violations = Array.from({ length: 101 }, (_, index) => ({
    code: "LT01",
    description: "Unexpected whitespace",
    line_no: index + 1,
  }));
  const report = createReport({ violations, warnings: violations.length });
  const updates: Array<{
    output?: { annotations?: unknown[]; text?: string };
  }> = [];
  const octokit = {
    rest: {
      checks: {
        update: async (input: { output?: { annotations?: unknown[] } }) => {
          updates.push(input);
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  const result = await completeCheckRun({
    octokit,
    owner: "acme",
    repo: "analytics",
    checkRunId: "123",
    conclusion: "success",
    report,
    changedFiles: [
      {
        filename: "models/orders.sql",
        patch: [
          "@@ -0,0 +1,101 @@",
          ...Array.from({ length: 101 }, (_, index) => `+line ${index + 1}`),
        ].join("\n"),
      },
    ],
  });

  assert.equal(result.annotationsPosted, 101);
  assert.equal(updates.length, 3);
  assert.deepEqual(
    updates.map((update) => update.output?.annotations?.length),
    [CHECK_ANNOTATION_BATCH_SIZE, CHECK_ANNOTATION_BATCH_SIZE, 1],
  );
  assert.ok(
    updates.every((update) => update.output?.text === updates[0].output?.text),
  );
  assert.match(updates[0].output?.text ?? "", /### Warnings/);
});

test("formats the concise check summary with singular labels", () => {
  const report = createReport({
    errors: 1,
    warnings: 1,
    violations: [],
  });

  assert.equal(
    formatCheckRunSummary(report),
    "Score: 70/100 — 1 error, 1 warning across 1 file.",
  );
});
