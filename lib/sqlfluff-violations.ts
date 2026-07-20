export type SqlfluffViolation = {
  code?: string;
  description?: string;
  line_no?: number;
  line_pos?: number;
  start_line_no?: number;
  start_line_pos?: number;
  sourceLine?: string;
  [key: string]: unknown;
};

const SYNTHETIC_EXECUTION_CODES = new Set([
  "TMP_EXEC_ERROR",
  "TMP_FILE_READ_ERROR",
  "TMP_TIMEOUT",
]);

export function hasReliableSourceLocation(violation: SqlfluffViolation) {
  return !SYNTHETIC_EXECUTION_CODES.has(violation.code?.toUpperCase() ?? "");
}

export function normalizeSqlfluffViolation(
  violation: SqlfluffViolation,
): SqlfluffViolation {
  if (!hasReliableSourceLocation(violation)) {
    const withoutLocation = { ...violation };
    delete withoutLocation.line_no;
    delete withoutLocation.line_pos;
    delete withoutLocation.sourceLine;
    return withoutLocation;
  }

  const lineNo = violation.line_no ?? violation.start_line_no;
  const linePos = violation.line_pos ?? violation.start_line_pos;

  return {
    ...violation,
    ...(lineNo === undefined ? {} : { line_no: lineNo }),
    ...(linePos === undefined ? {} : { line_pos: linePos }),
  };
}

export function attachSourceLineToViolation(
  violation: SqlfluffViolation,
  sourceLines: readonly string[],
): SqlfluffViolation {
  const normalized = normalizeSqlfluffViolation(violation);
  const lineNo = normalized.line_no;

  if (typeof lineNo !== "number" || !Number.isInteger(lineNo) || lineNo < 1) {
    return normalized;
  }

  const sourceLine = sourceLines[lineNo - 1];
  return sourceLine === undefined ? normalized : { ...normalized, sourceLine };
}
