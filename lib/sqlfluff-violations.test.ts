import assert from "node:assert/strict";
import test from "node:test";
import { explainFileViolations } from "./reports/report-recommendations";
import {
  attachSourceLineToViolation,
  formatViolationSourceSnippet,
  normalizeSqlfluffViolation,
} from "./sqlfluff-violations";

const sourceLines = Array.from({ length: 35 }, (_, index) =>
  index === 13
    ? "        {{ dbt_utils.generate_surrogate_key(['actor_id']) }} as actor_sk,"
    : index === 28
      ? "left join actor_types on actors.type_id = actor_types.id"
      : `-- line ${index + 1}`,
);

test("formats a bounded source snippet for external annotations", () => {
  assert.equal(
    formatViolationSourceSnippet("one\ntwo\nthree\nfour"),
    "one\ntwo\nthree\n…",
  );
  assert.equal(
    formatViolationSourceSnippet("select * from orders", { maxLength: 10 }),
    "select *…",
  );
  assert.equal(formatViolationSourceSnippet(undefined), undefined);
});

test("normalizes SQLFluff 4 start coordinates and attaches source lines", () => {
  const tmp = attachSourceLineToViolation(
    {
      code: "TMP",
      description: "Undefined jinja template variable: 'dbt_utils'",
      start_line_no: 14,
      start_line_pos: 12,
    },
    sourceLines,
  );
  const st11 = attachSourceLineToViolation(
    {
      code: "ST11",
      description:
        "Joined table 'actor_types' not referenced elsewhere in query",
      start_line_no: 29,
      start_line_pos: 15,
    },
    sourceLines,
  );

  assert.deepEqual(
    [tmp.line_no, tmp.line_pos, tmp.sourceLine],
    [14, 12, sourceLines[13]],
  );
  assert.deepEqual(
    [st11.line_no, st11.line_pos, st11.sourceLine],
    [29, 15, sourceLines[28]],
  );
});

test("cleans parse-error titles while preserving structured location", () => {
  const raw = attachSourceLineToViolation(
    {
      code: "PRS",
      description:
        "Line 14, Position 10: Found unparsable section: 'as actor_sk,...'",
      start_line_no: 14,
      start_line_pos: 62,
    },
    sourceLines,
  );
  const [friendly] = explainFileViolations([raw]);

  assert.equal(friendly.lineNo, 14);
  assert.equal(friendly.linePos, 62);
  assert.equal(friendly.sourceLine, sourceLines[13]);
  assert.equal(friendly.title.startsWith("Line 14, Position 10:"), false);
  assert.equal(friendly.title.startsWith("Found unparsable section"), true);
});

test("synthetic execution errors never claim a source location", () => {
  const normalized = normalizeSqlfluffViolation({
    code: "TMP_EXEC_ERROR",
    description: "sqlfluff failed",
    line_no: 1,
    line_pos: 1,
    sourceLine: "select * from unrelated_first_line",
  });
  const [friendly] = explainFileViolations([normalized]);

  assert.equal(friendly.lineNo, undefined);
  assert.equal(friendly.linePos, undefined);
  assert.equal(friendly.sourceLine, undefined);
});
