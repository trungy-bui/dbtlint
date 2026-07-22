import type { Octokit } from "@octokit/rest";
import type { LintReportJson } from "@/db/schema";
import { explainFileViolations } from "@/lib/reports/report-recommendations";
import { isErrorSqlfluffViolation } from "@/lib/sqlfluff-violations";

const CHECK_RUN_NAME = "dbtlint";
export const CHECK_ANNOTATION_BATCH_SIZE = 50;

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
        annotations.push({
          path: file.filePath,
          start_line: violation.lineNo,
          end_line: violation.lineNo,
          annotation_level: isErrorSqlfluffViolation({
            code: violation.rawCode,
          })
            ? "failure"
            : "warning",
          message: violation.explanation,
          title: violation.title,
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
        annotations: batch,
      },
    });
  }

  return { annotationsPosted: annotations.length };
}
