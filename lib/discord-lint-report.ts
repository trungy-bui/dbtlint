import type { LintReportJson } from "@/db/schema";

const LINT_REPORT_CATEGORIES = ["models", "tests", "macros"] as const;

export function getScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

export function formatIssueSummary(errors: number, warnings: number) {
  if (errors === 0 && warnings === 0) {
    return "No issues found — nice work!";
  }

  const errorLabel = errors === 1 ? "error" : "errors";
  const warningLabel = warnings === 1 ? "warning" : "warnings";

  return `Found ${errors} ${errorLabel} and ${warnings} ${warningLabel} across this dbt project.`;
}

export function formatCategoryBreakdown(
  categories: LintReportJson["categories"],
) {
  return LINT_REPORT_CATEGORIES.map((category) => {
    const categoryReport = categories[category];
    const label = category[0].toUpperCase() + category.slice(1);

    if (categoryReport.skipped) {
      return `**${label}** — skipped`;
    }

    const errors = categoryReport.files.reduce(
      (total, file) => total + file.errors,
      0,
    );
    const warnings = categoryReport.files.reduce(
      (total, file) => total + file.warnings,
      0,
    );

    return `**${label}** — ${errors} errors · ${warnings} warnings`;
  }).join("\n");
}

export function getBrandIconUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  try {
    return new URL("/favicon.ico", siteUrl).toString();
  } catch {
    return undefined;
  }
}
