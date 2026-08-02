import type { Octokit } from "@octokit/rest";
import type { LintReportJson } from "@/db/schema";
import { explainFileViolations } from "@/lib/reports/report-recommendations";
import { isErrorSqlfluffViolation } from "@/lib/sqlfluff-violations";
import { addedLinesFromPatch, type PullRequestFileDiff } from "./checks";

export const REVIEW_COMMENT_MARKER = "<!-- dbtlint:inline-review:v1 -->";
export const MAX_REVIEW_COMMENTS = 50;
export const MAX_REVIEW_FINDINGS_PER_FILE = 10;

export type PullRequestReviewComment = {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
};

type ReviewFinding = {
  path: string;
  line: number;
  rule: string;
  title: string;
  severity: "error" | "warning";
  explanation: string;
};

type FriendlyViolation = ReturnType<typeof explainFileViolations>[number];

function findingFromViolation(
  path: string,
  violation: FriendlyViolation,
): ReviewFinding | null {
  if (violation.lineNo === undefined) return null;

  return {
    path,
    line: violation.lineNo,
    rule: violation.rawCode?.trim() || "Unknown rule",
    title: violation.title,
    severity: isErrorSqlfluffViolation({ code: violation.rawCode })
      ? "error"
      : "warning",
    explanation: violation.explanation,
  };
}

function formatReviewComment(
  finding: ReviewFinding,
  omittedForFile: number,
  reportUrl: string,
) {
  const heading = `**${finding.title}** (\`${finding.rule}\`) - **Severity: ${finding.severity}**`;
  const truncation =
    omittedForFile > 0
      ? `\n\n[+${omittedForFile} more ${omittedForFile === 1 ? "finding" : "findings"} in this file; see the full DBTLint report](${reportUrl})`
      : "";

  return `${heading}\n\n${finding.explanation}${truncation}\n\n${REVIEW_COMMENT_MARKER}`;
}

function findingsByFile(
  report: LintReportJson,
  changedFiles: readonly PullRequestFileDiff[],
) {
  const addedLinesByPath = new Map(
    changedFiles.map((file) => [
      file.filename,
      addedLinesFromPatch(file.patch),
    ]),
  );
  const grouped = new Map<string, ReviewFinding[]>();

  for (const category of Object.values(report.categories)) {
    for (const file of category.files) {
      const addedLines = addedLinesByPath.get(file.filePath);
      if (!addedLines) continue;

      for (const violation of explainFileViolations(file.violations)) {
        const finding = findingFromViolation(file.filePath, violation);
        if (!finding || !addedLines.has(finding.line)) continue;
        const fileFindings = grouped.get(file.filePath) ?? [];
        fileFindings.push(finding);
        grouped.set(file.filePath, fileFindings);
      }
    }
  }

  for (const fileFindings of grouped.values()) {
    fileFindings.sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "error" ? -1 : 1;
      }
      return left.line - right.line;
    });
  }

  return grouped;
}

export function buildPullRequestReviewComments({
  report,
  changedFiles,
  reportUrl,
  maxComments = MAX_REVIEW_COMMENTS,
  maxFindingsPerFile = MAX_REVIEW_FINDINGS_PER_FILE,
}: {
  report: LintReportJson;
  changedFiles: readonly PullRequestFileDiff[];
  reportUrl: string;
  maxComments?: number;
  maxFindingsPerFile?: number;
}) {
  const grouped = findingsByFile(report, changedFiles);
  const selected = new Map<string, ReviewFinding[]>();
  const paths = [...grouped.keys()];
  let commentCount = 0;

  // Round-robin allocation gives every changed file a finding before any one
  // noisy file consumes the review-wide safety limit.
  for (
    let findingIndex = 0;
    findingIndex < maxFindingsPerFile && commentCount < maxComments;
    findingIndex += 1
  ) {
    let selectedAtThisIndex = false;
    for (const path of paths) {
      if (commentCount >= maxComments) break;
      const finding = grouped.get(path)?.[findingIndex];
      if (!finding) continue;
      const fileSelection = selected.get(path) ?? [];
      fileSelection.push(finding);
      selected.set(path, fileSelection);
      commentCount += 1;
      selectedAtThisIndex = true;
    }
    if (!selectedAtThisIndex) break;
  }

  const comments: PullRequestReviewComment[] = [];
  for (const path of paths) {
    const fileSelection = selected.get(path) ?? [];
    const totalForFile = grouped.get(path)?.length ?? 0;
    for (const [index, finding] of fileSelection.entries()) {
      const isLastForFile = index === fileSelection.length - 1;
      comments.push({
        path: finding.path,
        line: finding.line,
        side: "RIGHT",
        body: formatReviewComment(
          finding,
          isLastForFile ? totalForFile - fileSelection.length : 0,
          reportUrl,
        ),
      });
    }
  }

  return {
    comments,
    findingsFound: [...grouped.values()].reduce(
      (total, findings) => total + findings.length,
      0,
    ),
  };
}

export async function replacePullRequestReviewComments({
  octokit,
  owner,
  repo,
  pullNumber,
  headSha,
  report,
  changedFiles,
  reportUrl,
}: {
  octokit: Octokit;
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  report: LintReportJson;
  changedFiles: readonly PullRequestFileDiff[];
  reportUrl: string;
}) {
  const priorComments = await octokit.paginate(
    octokit.rest.pulls.listReviewComments,
    {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    },
  );
  const priorDbtLintComments = priorComments.filter((comment) =>
    comment.body?.includes(REVIEW_COMMENT_MARKER),
  );
  const { comments, findingsFound } = buildPullRequestReviewComments({
    report,
    changedFiles,
    reportUrl,
  });

  // Publish the replacement first so a transient create failure cannot erase
  // the last successful scan's feedback.
  if (comments.length > 0) {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: headSha,
      event: "COMMENT",
      body: `DBTLint found ${findingsFound} inline ${findingsFound === 1 ? "finding" : "findings"}. [View the full check-run report](${reportUrl}).`,
      comments,
    });
  }

  for (const comment of priorDbtLintComments) {
    await octokit.rest.pulls.deleteReviewComment({
      owner,
      repo,
      comment_id: comment.id,
    });
  }

  return {
    commentsPosted: comments.length,
    commentsReplaced: priorDbtLintComments.length,
    findingsFound,
  };
}
