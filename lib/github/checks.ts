import type { Octokit } from "@octokit/rest";
import type { LintReportJson } from "@/db/schema";
import {
  explainFileViolations,
  formatFriendlyViolationMessage,
} from "@/lib/reports/report-recommendations";
import {
  formatViolationSourceSnippet,
  isErrorSqlfluffViolation,
} from "@/lib/sqlfluff-violations";

const CHECK_RUN_NAME = "dbtlint";
export const CHECK_ANNOTATION_BATCH_SIZE = 50;
export const CHECK_RUN_TEXT_MAX_LENGTH = 65_535;

export type PullRequestFileDiff = {
  filename: string;
  patch?: string;
};

export type CheckRunAnnotation = {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "warning" | "failure";
  message: string;
  title: string;
  raw_details?: string;
};

export function addedLinesFromPatch(patch: string | undefined) {
  const addedLines = new Set<number>();
  if (!patch) return addedLines;

  let newLineNumber: number | null = null;
  for (const line of patch.split("\n")) {
    const hunkHeader = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkHeader) {
      newLineNumber = Number.parseInt(hunkHeader[1], 10);
      continue;
    }
    if (newLineNumber === null || line.startsWith("\\ No newline")) continue;
    if (line.startsWith("-")) continue;
    if (line.startsWith("+")) addedLines.add(newLineNumber);
    newLineNumber += 1;
  }

  return addedLines;
}

export function buildCheckRunAnnotations(
  report: LintReportJson,
  changedFiles: readonly PullRequestFileDiff[],
): CheckRunAnnotation[] {
  const addedLinesByPath = new Map(
    changedFiles.map((file) => [
      file.filename,
      addedLinesFromPatch(file.patch),
    ]),
  );
  const annotations: CheckRunAnnotation[] = [];

  for (const category of Object.values(report.categories)) {
    for (const file of category.files) {
      const addedLines = addedLinesByPath.get(file.filePath);
      if (!addedLines) continue;

      const friendlyViolations = explainFileViolations(file.violations);
      for (const violation of friendlyViolations) {
        if (
          violation.lineNo === undefined ||
          !addedLines.has(violation.lineNo)
        ) {
          continue;
        }
        const sourceSnippet = formatViolationSourceSnippet(
          violation.sourceLine,
        );
        annotations.push({
          path: file.filePath,
          start_line: violation.lineNo,
          end_line: violation.lineNo,
          annotation_level: isErrorSqlfluffViolation({
            code: violation.rawCode,
          })
            ? "failure"
            : "warning",
          message: formatFriendlyViolationMessage(violation),
          title: violation.title,
          ...(sourceSnippet ? { raw_details: sourceSnippet } : {}),
        });
      }
    }
  }

  return annotations;
}

export function chunkCheckRunAnnotations(
  annotations: readonly CheckRunAnnotation[],
) {
  const chunks: CheckRunAnnotation[][] = [];
  for (
    let index = 0;
    index < annotations.length;
    index += CHECK_ANNOTATION_BATCH_SIZE
  ) {
    chunks.push(annotations.slice(index, index + CHECK_ANNOTATION_BATCH_SIZE));
  }
  return chunks;
}

function pluralize(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function formatCheckRunSummary(report: LintReportJson) {
  return `Score: ${report.score}/100 — ${pluralize(report.totals.errors, "error")}, ${pluralize(report.totals.warnings, "warning")} across ${pluralize(report.totals.files, "file")}.`;
}

type CheckRunTextSeverity = "error" | "warning";

type CheckRunTextDetail = {
  severity: CheckRunTextSeverity;
  line: string;
};

function inlineCode(value: string) {
  return `\`${value.replaceAll("`", "'")}\``;
}

function singleLine(value: string | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function checkRunTextDetails(report: LintReportJson): CheckRunTextDetail[] {
  const details: CheckRunTextDetail[] = [];

  for (const category of Object.values(report.categories)) {
    for (const file of category.files) {
      for (const violation of explainFileViolations(file.violations)) {
        const severity: CheckRunTextSeverity = isErrorSqlfluffViolation({
          code: violation.rawCode,
        })
          ? "error"
          : "warning";
        const location =
          violation.lineNo === undefined
            ? file.filePath
            : `${file.filePath}:${violation.lineNo}`;
        const code = singleLine(violation.rawCode, "unknown rule");
        const message = singleLine(
          violation.rawDescription,
          violation.title || "No description provided",
        );

        details.push({
          severity,
          line: `- ${inlineCode(location)} — ${inlineCode(code)} — ${message}`,
        });
      }
    }
  }

  return details.sort((left, right) => {
    if (left.severity === right.severity) return 0;
    return left.severity === "error" ? -1 : 1;
  });
}

function renderCheckRunText(details: readonly CheckRunTextDetail[]) {
  const errors = details
    .filter((detail) => detail.severity === "error")
    .map((detail) => detail.line);
  const warnings = details
    .filter((detail) => detail.severity === "warning")
    .map((detail) => detail.line);
  const sections: string[] = [];

  if (errors.length > 0) sections.push(`### Errors\n\n${errors.join("\n")}`);
  if (warnings.length > 0) {
    sections.push(`### Warnings\n\n${warnings.join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatTruncationNotice(details: readonly CheckRunTextDetail[]) {
  const errors = details.filter((detail) => detail.severity === "error").length;
  const warnings = details.length - errors;
  const omitted = [
    errors > 0 ? `${errors} more ${errors === 1 ? "error" : "errors"}` : null,
    warnings > 0
      ? `${warnings} more ${warnings === 1 ? "warning" : "warnings"}`
      : null,
  ].filter((count): count is string => count !== null);

  if (omitted.length === 0) return "";
  return `_…${omitted.join(" and ")} truncated. See the full DBTLint report for all details._`;
}

export function formatCheckRunText(
  report: LintReportJson,
  maxLength = CHECK_RUN_TEXT_MAX_LENGTH,
) {
  const allDetails = checkRunTextDetails(report);
  if (allDetails.length === 0) return "";

  const fullText = renderCheckRunText(allDetails);
  if (fullText.length <= maxLength) return fullText;

  const included: CheckRunTextDetail[] = [];
  for (let index = 0; index < allDetails.length; index += 1) {
    const candidate = [...included, allDetails[index]];
    const notice = formatTruncationNotice(allDetails.slice(index + 1));
    const text = [renderCheckRunText(candidate), notice]
      .filter(Boolean)
      .join("\n\n");

    if (text.length > maxLength) break;
    included.push(allDetails[index]);
  }

  const notice = formatTruncationNotice(allDetails.slice(included.length));
  return [renderCheckRunText(included), notice]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxLength);
}

export async function createCheckRun({
  octokit,
  owner,
  repo,
  headSha,
  scanId,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  headSha: string;
  scanId: string;
}) {
  const response = await octokit.rest.checks.create({
    owner,
    repo,
    name: CHECK_RUN_NAME,
    head_sha: headSha,
    status: "in_progress",
    started_at: new Date().toISOString(),
    external_id: scanId,
  });
  return String(response.data.id);
}

export async function completeCheckRun({
  octokit,
  owner,
  repo,
  checkRunId,
  conclusion,
  report,
  changedFiles,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  checkRunId: string;
  conclusion: "success" | "failure";
  report: LintReportJson;
  changedFiles: readonly PullRequestFileDiff[];
}) {
  const annotations = buildCheckRunAnnotations(report, changedFiles);
  const annotationChunks = chunkCheckRunAnnotations(annotations);
  const batches = annotationChunks.length > 0 ? annotationChunks : [[]];
  const completedAt = new Date().toISOString();
  const title =
    conclusion === "success" ? "dbtlint passed" : "dbtlint found issues";
  const summary = formatCheckRunSummary(report);
  const text = formatCheckRunText(report);

  for (const batch of batches) {
    await octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: Number(checkRunId),
      status: "completed",
      conclusion,
      completed_at: completedAt,
      output: {
        title,
        summary,
        text,
        annotations: batch,
      },
    });
  }

  return { annotationsPosted: annotations.length };
}
