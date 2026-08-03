import { isAutofixableRule } from "@/lib/rules/rule-engine";
import type {
  DeterministicFix,
  SqlfluffEdit,
  SqlfluffViolation,
} from "@/lib/sqlfluff-violations";

type NormalizedEdit = {
  edit: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function normalizeEdit(edit: SqlfluffEdit): NormalizedEdit | null {
  if (
    typeof edit.edit !== "string" ||
    !positiveInteger(edit.start_line_no) ||
    !positiveInteger(edit.start_line_pos) ||
    !positiveInteger(edit.end_line_no) ||
    !positiveInteger(edit.end_line_pos)
  ) {
    return null;
  }

  return {
    edit: edit.edit,
    startLine: edit.start_line_no,
    startColumn: edit.start_line_pos,
    endLine: edit.end_line_no,
    endColumn: edit.end_line_pos,
  };
}

function offsetForPosition(
  lines: readonly string[],
  firstLine: number,
  line: number,
  column: number,
) {
  const relativeLine = line - firstLine;
  const sourceLine = lines[relativeLine];
  if (sourceLine === undefined || column > sourceLine.length + 1) return null;

  let offset = column - 1;
  for (let index = 0; index < relativeLine; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

/**
 * Converts SQLFluff's token edits into a DBTLint-owned replacement payload.
 * The payload replaces complete source lines so it can be consumed by GitHub
 * suggestions today and by a future local fixer without renderer coupling.
 */
export function generateDeterministicFix(
  violation: SqlfluffViolation,
  sourceLines: readonly string[],
): DeterministicFix | undefined {
  if (!isAutofixableRule(violation.code) || !Array.isArray(violation.fixes)) {
    return undefined;
  }

  const edits = violation.fixes.map(normalizeEdit);
  if (edits.length === 0 || edits.some((edit) => edit === null)) {
    return undefined;
  }
  const normalizedEdits = edits as NormalizedEdit[];
  const startLine = Math.min(...normalizedEdits.map((edit) => edit.startLine));
  const endLine = Math.max(...normalizedEdits.map((edit) => edit.endLine));
  const selectedLines = sourceLines.slice(startLine - 1, endLine);
  if (selectedLines.length !== endLine - startLine + 1) return undefined;

  const editsWithOffsets = normalizedEdits.map((edit) => {
    const startOffset = offsetForPosition(
      selectedLines,
      startLine,
      edit.startLine,
      edit.startColumn,
    );
    const endOffset = offsetForPosition(
      selectedLines,
      startLine,
      edit.endLine,
      edit.endColumn,
    );
    return { ...edit, startOffset, endOffset };
  });
  if (
    editsWithOffsets.some(
      ({ startOffset, endOffset }) =>
        startOffset === null || endOffset === null || startOffset > endOffset,
    )
  ) {
    return undefined;
  }

  const descendingEdits = editsWithOffsets
    .map((edit) => ({
      ...edit,
      startOffset: edit.startOffset as number,
      endOffset: edit.endOffset as number,
    }))
    .sort((left, right) => right.startOffset - left.startOffset);
  for (let index = 1; index < descendingEdits.length; index += 1) {
    if (
      descendingEdits[index - 1].startOffset < descendingEdits[index].endOffset
    ) {
      return undefined;
    }
  }

  const oldText = selectedLines.join("\n");
  let newText = oldText;
  for (const edit of descendingEdits) {
    newText = `${newText.slice(0, edit.startOffset)}${edit.edit}${newText.slice(edit.endOffset)}`;
  }
  if (newText === oldText) return undefined;

  return {
    oldText,
    newText,
    range: {
      start: { line: startLine, column: 1 },
      end: {
        line: endLine,
        column: selectedLines[selectedLines.length - 1].length + 1,
      },
    },
  };
}

export function attachDeterministicFix(
  violation: SqlfluffViolation,
  sourceLines: readonly string[],
): SqlfluffViolation {
  const fix = generateDeterministicFix(violation, sourceLines);
  return fix ? { ...violation, autofixable: true, fix } : violation;
}
