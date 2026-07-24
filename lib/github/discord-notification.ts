import * as Sentry from "@sentry/nextjs";
import type { LintReportJson } from "@/db/schema";
import { type SendDiscordAlertInput, sendDiscordAlert } from "@/lib/discord";
import {
  formatCategoryBreakdown,
  formatIssueSummary,
  getBrandIconUrl,
  getScoreLabel,
} from "@/lib/discord-lint-report";

type ScanningUser = {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
} | null;

type GitHubPrScanDiscordInput = {
  scanId: string;
  repoFullName: string;
  prNumber: number;
  headSha: string;
  report: LintReportJson;
  scanningUser: ScanningUser;
};

type DiscordNotificationDependencies = {
  sendAlert: (input: SendDiscordAlertInput) => Promise<void>;
  captureException: (
    error: unknown,
    context: {
      tags: Record<string, string>;
      extra: Record<string, string | number>;
    },
  ) => void;
  logError: (message: string, context: Record<string, unknown>) => void;
};

const defaultDependencies: DiscordNotificationDependencies = {
  sendAlert: sendDiscordAlert,
  captureException: Sentry.captureException,
  logError: console.error,
};

function getInternalScanDetailsUrl(scanId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;

  try {
    return new URL(
      `/projects/${encodeURIComponent(scanId)}`,
      siteUrl,
    ).toString();
  } catch {
    console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL");
    return undefined;
  }
}

export function buildGitHubPrScanDiscordAlert({
  scanId,
  repoFullName,
  prNumber,
  headSha,
  report,
  scanningUser,
}: GitHubPrScanDiscordInput): SendDiscordAlertInput {
  const passed = report.totals.errors === 0;
  const pullRequestUrl = `https://github.com/${repoFullName}/pull/${prNumber}`;
  const scanDetailsUrl = getInternalScanDetailsUrl(scanId);
  const scanningUserName =
    scanningUser?.fullName?.trim() || scanningUser?.email;

  return {
    author: scanningUserName
      ? {
          name: scanningUserName,
          iconUrl: scanningUser?.avatarUrl ?? undefined,
        }
      : undefined,
    title: passed
      ? `✅ ${repoFullName} #${prNumber} passed`
      : `⚠️ ${repoFullName} #${prNumber} needs attention`,
    description: formatIssueSummary(
      report.totals.errors,
      report.totals.warnings,
    ),
    level: passed ? "success" : "warning",
    url: pullRequestUrl,
    fields: [
      {
        name: "Score",
        value: `**${report.score}/100 — ${getScoreLabel(report.score)}**`,
      },
      {
        name: "Errors",
        value: report.totals.errors.toString(),
        inline: true,
      },
      {
        name: "Warnings",
        value: report.totals.warnings.toString(),
        inline: true,
      },
      {
        name: "Issues by category",
        value: formatCategoryBreakdown(report.categories),
      },
      {
        name: "GitHub pull request",
        value: `[View ${repoFullName} #${prNumber}](${pullRequestUrl})`,
      },
      ...(scanDetailsUrl
        ? [
            {
              name: "Full results",
              value: `[View scan details](${scanDetailsUrl})`,
            },
          ]
        : []),
    ],
    footer: `Technical reference · Scan ID: ${scanId} · Commit: ${headSha.slice(0, 7)}`,
    footerIconUrl: getBrandIconUrl(),
  };
}

export async function sendGitHubPrScanDiscordAlertBestEffort(
  input: GitHubPrScanDiscordInput,
  dependencies: DiscordNotificationDependencies = defaultDependencies,
) {
  try {
    await dependencies.sendAlert(buildGitHubPrScanDiscordAlert(input));
  } catch (error) {
    dependencies.logError("Failed to send GitHub PR scan Discord alert", {
      error,
      scanId: input.scanId,
      repoFullName: input.repoFullName,
      prNumber: input.prNumber,
      headSha: input.headSha,
    });
    dependencies.captureException(error, {
      tags: {
        notification_provider: "discord",
        integration: "github_pr_scan",
      },
      extra: {
        scanId: input.scanId,
        repoFullName: input.repoFullName,
        prNumber: input.prNumber,
        headSha: input.headSha,
      },
    });
  }
}
