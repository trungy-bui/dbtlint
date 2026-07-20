import type { LintReportJson } from "@/db/schema";
import {
  hasReliableSourceLocation,
  normalizeSqlfluffViolation,
} from "@/lib/sqlfluff-violations";
import {
  explainViolation,
  type FriendlyExplanation,
  summarizeRecommendations,
} from "./rule-explanations";

type Violation = { code?: string; description?: string };

export type RecommendationGroup = {
  category: FriendlyExplanation["category"];
  items: Array<FriendlyExplanation & { occurrences: number }>;
  totalOccurrences: number;
};

const RECOMMENDATION_CATEGORY_ORDER: FriendlyExplanation["category"][] = [
  "Broken query",
  "Data risk",
  "Performance",
  "Readability",
  "Formatting",
];

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

export function groupRecommendationsByCategory(
  recommendations: Array<FriendlyExplanation & { occurrences: number }>,
): RecommendationGroup[] {
  return RECOMMENDATION_CATEGORY_ORDER.flatMap((category) => {
    const items = recommendations.filter(
      (recommendation) => recommendation.category === category,
    );

    return items.length > 0
      ? [
          {
            category,
            items,
            totalOccurrences: items.reduce(
              (total, item) => total + item.occurrences,
              0,
            ),
          },
        ]
      : [];
  });
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
  return violations.map((violation) => {
    const normalized = normalizeSqlfluffViolation(violation);
    const hasSourceLocation = hasReliableSourceLocation(normalized);

    return {
      ...explainViolation(normalized),
      lineNo: hasSourceLocation ? normalized.line_no : undefined,
      linePos: hasSourceLocation ? normalized.line_pos : undefined,
      sourceLine: hasSourceLocation ? normalized.sourceLine : undefined,
      rawCode: normalized.code,
      rawDescription: normalized.description,
    };
  });
}
