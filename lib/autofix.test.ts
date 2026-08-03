import assert from "node:assert/strict";
import test from "node:test";
import { attachDeterministicFix, generateDeterministicFix } from "./autofix";

test("generates a whitespace/spacing replacement payload", () => {
  const violation = attachDeterministicFix(
    {
      code: "LT01",
      fixes: [
        {
          type: "replace",
          edit: " ",
          start_line_no: 1,
          start_line_pos: 7,
          end_line_no: 1,
          end_line_pos: 9,
        },
      ],
    },
    ["select  amount from orders"],
  );

  assert.equal(violation.autofixable, true);
  assert.deepEqual(violation.fix, {
    oldText: "select  amount from orders",
    newText: "select amount from orders",
    range: {
      start: { line: 1, column: 1 },
      end: { line: 1, column: 27 },
    },
  });
});

test("generates a quote-style replacement payload", () => {
  const fix = generateDeterministicFix(
    {
      code: "CV10",
      fixes: [
        {
          type: "replace",
          edit: "'beta'",
          start_line_no: 1,
          start_line_pos: 17,
          end_line_no: 1,
          end_line_pos: 23,
        },
      ],
    },
    ["select 'alpha', \"beta\" from foo"],
  );

  assert.equal(fix?.oldText, "select 'alpha', \"beta\" from foo");
  assert.equal(fix?.newText, "select 'alpha', 'beta' from foo");
  assert.deepEqual(fix?.range, {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 32 },
  });
});

test("generates a trailing-comma deletion payload", () => {
  const fix = generateDeterministicFix(
    {
      code: "CV03",
      fixes: [
        {
          type: "delete",
          edit: "",
          start_line_no: 1,
          start_line_pos: 14,
          end_line_no: 1,
          end_line_pos: 15,
        },
      ],
    },
    ["select amount, from orders"],
  );

  assert.equal(fix?.oldText, "select amount, from orders");
  assert.equal(fix?.newText, "select amount from orders");
});

test("refuses edits from rules that are not explicitly autofixable", () => {
  const violation = attachDeterministicFix(
    {
      code: "PRS",
      fixes: [
        {
          type: "replace",
          edit: "select 1",
          start_line_no: 1,
          start_line_pos: 1,
          end_line_no: 1,
          end_line_pos: 8,
        },
      ],
    },
    ["broken!"],
  );

  assert.equal(violation.autofixable, undefined);
  assert.equal(violation.fix, undefined);
});
