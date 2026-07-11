import type { LintReportJson } from "@/db/schema";
import {
  explainViolation,
  type FriendlyExplanation,
  summarizeRecommendations,
} from "./rule-explanations";

type Violation = { code?: string; description?: string };

/**
 * Pulls every violation out of every file in every category
 * (models/tests/macros) into one flat list.
 */
function flattenViolations(report: LintReportJson): Violation[] {
  const categories = Object.values(report.categories);
  return categories.flatMap((category) =>
    category.files.flatMap((file) => file.violations),
  );
}

/**
 * Top-level "Recommendations" panel data — grouped + deduped + counted,
 * sorted so data-risk/broken-query issues surface above pure formatting.
 * This is what powers the panel in your screenshot.
 */
export function buildRecommendations(
  report: LintReportJson,
): Array<FriendlyExplanation & { occurrences: number }> {
  return summarizeRecommendations(flattenViolations(report));
}

/**
 * Per-file violation list (the expanded accordion under customers.sql,
 * orders.sql, etc). Keeps line_no/line_pos and the raw code for a
 * "technical details" toggle, but adds the friendly title + explanation
 * for the primary display.
 */
export function explainFileViolations(
  violations: LintReportJson["categories"]["models"]["files"][number]["violations"],
) {
  return violations.map((violation) => ({
    ...explainViolation(violation),
    lineNo: violation.line_no,
    linePos: violation.line_pos,
    rawCode: violation.code,
    rawDescription: violation.description,
  }));
}
