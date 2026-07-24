import assert from "node:assert/strict";
import test from "node:test";
import type { LintReportJson } from "@/db/schema";
import {
  buildGitHubPrScanDiscordAlert,
  sendGitHubPrScanDiscordAlertBestEffort,
} from "./discord-notification";

function createReport(errors: number, warnings: number): LintReportJson {
  return {
    categories: {
      models: {
        folderPath: "models",
        files: [
          { filePath: "models/example.sql", errors, warnings, violations: [] },
        ],
        skipped: false,
      },
      tests: {
        folderPath: null,
        files: [],
        skipped: true,
      },
      macros: {
        folderPath: null,
        files: [],
        skipped: true,
      },
    },
    totals: {
      files: 1,
      lines: 10,
      errors,
      warnings,
    },
    score: errors === 0 ? 95 : 40,
  };
}

const baseInput = {
  scanId: "scan-123",
  repoFullName: "acme/analytics",
  prNumber: 42,
  headSha: "abcdef1234567890",
  scanningUser: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    avatarUrl: "https://example.com/ada.png",
  },
};

test("builds a successful GitHub PR Discord embed", () => {
  const alert = buildGitHubPrScanDiscordAlert({
    ...baseInput,
    report: createReport(0, 1),
  });

  assert.equal(alert.level, "success");
  assert.equal(alert.title, "✅ acme/analytics #42 passed");
  assert.equal(alert.url, "https://github.com/acme/analytics/pull/42");
  assert.deepEqual(alert.author, {
    name: "Ada Lovelace",
    iconUrl: "https://example.com/ada.png",
  });
  assert.match(alert.footer ?? "", /Commit: abcdef1/);
});

test("builds a failed GitHub PR Discord embed", () => {
  const alert = buildGitHubPrScanDiscordAlert({
    ...baseInput,
    report: createReport(2, 3),
  });

  assert.equal(alert.level, "warning");
  assert.equal(alert.title, "⚠️ acme/analytics #42 needs attention");
  assert.equal(
    alert.description,
    "Found 2 errors and 3 warnings across this dbt project.",
  );
});

test("Discord send failures do not reject the scan side effect", async () => {
  const expectedError = new Error("Discord unavailable");
  let capturedError: unknown;

  await assert.doesNotReject(() =>
    sendGitHubPrScanDiscordAlertBestEffort(
      {
        ...baseInput,
        report: createReport(0, 0),
      },
      {
        sendAlert: async () => {
          throw expectedError;
        },
        captureException: (error) => {
          capturedError = error;
        },
        logError: () => {},
      },
    ),
  );

  assert.equal(capturedError, expectedError);
});
