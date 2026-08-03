import type { LintReportJson } from "@/db/schema";
import {
  hasReliableSourceLocation,
  normalizeSqlfluffViolation,
} from "@/lib/sqlfluff-violations";
import {
  explainViolation,
  type FriendlyExplanation,
} from "./rule-explanations";

export type RecommendationOccurrence = {
  filePath: string;
  lineNo?: number;
  linePos?: number;
  sourceLine?: string;
};

export type Recommendation = FriendlyExplanation & {
  occurrences: RecommendationOccurrence[];
};

export type RecommendationGroup = {
  category: FriendlyExplanation["category"];
  items: Recommendation[];
  totalOccurrences: number;
};

export function formatFriendlyViolationMessage(
  violation: Pick<FriendlyExplanation, "explanation" | "impact">,
) {
  if (violation.explanation === violation.impact) {
    return violation.explanation;
  }

  return `${violation.explanation}\n\nWhy it matters: ${violation.impact}`;
}

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
function flattenViolations(report: LintReportJson) {
  const categories = Object.values(report.categories);
  return categories.flatMap((category) =>
    category.files.flatMap((file) =>
      file.violations.map((violation) => ({
        filePath: file.filePath,
        violation: normalizeSqlfluffViolation(violation),
      })),
    ),
  );
}

/**
 * Top-level "Recommendations" panel data — grouped + deduped + counted,
 * sorted so data-risk/broken-query issues surface above pure formatting.
 * This is what powers the panel in your screenshot.
 */
export function buildRecommendations(report: LintReportJson): Recommendation[] {
  const byTitle = new Map<string, Recommendation>();

  for (const { filePath, violation } of flattenViolations(report)) {
    const explained = explainViolation(violation);
    const hasSourceLocation = hasReliableSourceLocation(violation);
    const occurrence: RecommendationOccurrence = {
      filePath,
      lineNo: hasSourceLocation ? violation.line_no : undefined,
      linePos: hasSourceLocation ? violation.line_pos : undefined,
      sourceLine: hasSourceLocation ? violation.sourceLine : undefined,
    };
    const existing = byTitle.get(explained.title);

    if (existing) {
      existing.occurrences.push(occurrence);
    } else {
      byTitle.set(explained.title, {
        ...explained,
        occurrences: [occurrence],
      });
    }
  }

  return Array.from(byTitle.values()).sort(
    (a, b) =>
      RECOMMENDATION_CATEGORY_ORDER.indexOf(a.category) -
      RECOMMENDATION_CATEGORY_ORDER.indexOf(b.category),
  );
}

export function groupRecommendationsByCategory(
  recommendations: Recommendation[],
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
              (total, item) => total + item.occurrences.length,
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
      autofixable: normalized.autofixable === true,
      fix: normalized.fix,
      rawCode: normalized.code,
      rawDescription: normalized.description,
    };
  });
}
