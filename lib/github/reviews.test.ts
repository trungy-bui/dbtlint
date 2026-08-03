import assert from "node:assert/strict";
import test from "node:test";
import type { Octokit } from "@octokit/rest";
import type { LintReportJson } from "@/db/schema";
import {
  buildPullRequestReviewComments,
  REVIEW_COMMENT_MARKER,
  replacePullRequestReviewComments,
} from "./reviews";

function createReport(
  violations: LintReportJson["categories"]["models"]["files"][number]["violations"],
): LintReportJson {
  return {
    categories: {
      models: {
        folderPath: "models",
        files: [
          {
            filePath: "models/orders.sql",
            errors: violations.filter(({ code }) => code === "PRS").length,
            warnings: violations.filter(({ code }) => code !== "PRS").length,
            violations,
          },
        ],
        skipped: false,
      },
      tests: { folderPath: null, files: [], skipped: true },
      macros: { folderPath: null, files: [], skipped: true },
    },
    totals: {
      files: 1,
      lines: 100,
      errors: violations.filter(({ code }) => code === "PRS").length,
      warnings: violations.filter(({ code }) => code !== "PRS").length,
    },
    score: 80,
  };
}

function changedFile(lineCount: number) {
  return {
    filename: "models/orders.sql",
    patch: [
      `@@ -0,0 +1,${lineCount} @@`,
      ...Array.from({ length: lineCount }, (_, index) => `+line ${index + 1}`),
    ].join("\n"),
  };
}

test("submits all inline findings in one pull request review", async () => {
  const reviewSubmissions: unknown[] = [];
  const octokit = {
    paginate: async () => [],
    rest: {
      pulls: {
        listReviewComments: async () => ({ data: [] }),
        createReview: async (input: unknown) => {
          reviewSubmissions.push(input);
          return { data: { id: 10 } };
        },
        deleteReviewComment: async () => ({ data: {} }),
      },
    },
  } as unknown as Octokit;

  const result = await replacePullRequestReviewComments({
    octokit,
    owner: "acme",
    repo: "analytics",
    pullNumber: 42,
    headSha: "abc123",
    report: createReport([
      { code: "LT01", description: "Whitespace", line_no: 1 },
      { code: "PRS", description: "Syntax error", line_no: 2 },
      { code: "LT02", description: "Indentation", line_no: 3 },
    ]),
    changedFiles: [changedFile(3)],
    reportUrl: "https://github.com/acme/analytics/runs/123",
  });

  assert.equal(reviewSubmissions.length, 1);
  const submission = reviewSubmissions[0] as {
    event: string;
    comments: Array<{ body: string; line: number; side: string }>;
  };
  assert.equal(submission.event, "COMMENT");
  assert.equal(submission.comments.length, 3);
  assert.ok(submission.comments.every(({ side }) => side === "RIGHT"));
  assert.match(submission.comments[0].body, /Severity: error/);
  assert.match(submission.comments[0].body, /`PRS`/);
  assert.equal(result.commentsPosted, 3);
});

test("replaces marked DBTLint comments on a rerun without touching other comments", async () => {
  const deletedCommentIds: number[] = [];
  let createReviewCalls = 0;
  const octokit = {
    paginate: async () => [
      { id: 101, body: `Old feedback\n${REVIEW_COMMENT_MARKER}` },
      { id: 202, body: "A maintainer comment" },
    ],
    rest: {
      pulls: {
        listReviewComments: async () => ({ data: [] }),
        createReview: async () => {
          createReviewCalls += 1;
          return { data: { id: 11 } };
        },
        deleteReviewComment: async ({ comment_id }: { comment_id: number }) => {
          deletedCommentIds.push(comment_id);
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  const result = await replacePullRequestReviewComments({
    octokit,
    owner: "acme",
    repo: "analytics",
    pullNumber: 42,
    headSha: "def456",
    report: createReport([
      { code: "LT02", description: "Indentation", line_no: 1 },
    ]),
    changedFiles: [changedFile(1)],
    reportUrl: "https://github.com/acme/analytics/runs/124",
  });

  assert.equal(createReviewCalls, 1);
  assert.deepEqual(deletedCommentIds, [101]);
  assert.equal(result.commentsReplaced, 1);
});

test("truncates noisy files and links the omitted count to the check report", () => {
  const reportUrl = "https://github.com/acme/analytics/runs/125";
  const violations = Array.from({ length: 5 }, (_, index) => ({
    code: "LT01",
    description: `Whitespace ${index + 1}`,
    line_no: index + 1,
  }));

  const result = buildPullRequestReviewComments({
    report: createReport(violations),
    changedFiles: [changedFile(5)],
    reportUrl,
    maxFindingsPerFile: 2,
  });

  assert.equal(result.findingsFound, 5);
  assert.equal(result.comments.length, 2);
  assert.doesNotMatch(result.comments[0].body, /more findings/);
  assert.match(result.comments[1].body, /\+3 more findings in this file/);
  assert.match(result.comments[1].body, new RegExp(reportUrl));
});

test("renders deterministic fixes with GitHub's native suggestion syntax", () => {
  const result = buildPullRequestReviewComments({
    report: createReport([
      {
        code: "LT01",
        description: "Expected one space",
        line_no: 1,
        autofixable: true,
        fix: {
          oldText: "select  amount from orders",
          newText: "select amount from orders",
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 27 },
          },
        },
      },
    ]),
    changedFiles: [changedFile(1)],
    reportUrl: "https://github.com/acme/analytics/runs/126",
  });

  assert.match(
    result.comments[0].body,
    /```suggestion\nselect amount from orders\n```/,
  );
  assert.deepEqual(
    {
      line: result.comments[0].line,
      side: result.comments[0].side,
      startLine: result.comments[0].start_line,
    },
    { line: 1, side: "RIGHT", startLine: undefined },
  );
});

test("never renders suggestions for non-autofixable rules", () => {
  const result = buildPullRequestReviewComments({
    report: createReport([
      {
        code: "PRS",
        description: "Syntax error",
        line_no: 1,
        autofixable: true,
        fix: {
          oldText: "broken!",
          newText: "select 1",
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 8 },
          },
        },
      },
    ]),
    changedFiles: [changedFile(1)],
    reportUrl: "https://github.com/acme/analytics/runs/127",
  });

  assert.doesNotMatch(result.comments[0].body, /```suggestion/);
});

test("does not render a fix payload unless the finding is marked autofixable", () => {
  const result = buildPullRequestReviewComments({
    report: createReport([
      {
        code: "LT01",
        description: "Expected one space",
        line_no: 1,
        fix: {
          oldText: "select  amount",
          newText: "select amount",
          range: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 15 },
          },
        },
      },
    ]),
    changedFiles: [changedFile(1)],
    reportUrl: "https://github.com/acme/analytics/runs/128",
  });

  assert.doesNotMatch(result.comments[0].body, /```suggestion/);
});
