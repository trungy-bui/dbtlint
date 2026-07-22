import { desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import db from "@/db";
import { githubPrScans, notifications, scans } from "@/db/schema";

const DASHBOARD_REVALIDATE_SECONDS = 60;

export type DashboardView =
  | "dashboard"
  | "projects"
  | "upload"
  | "rules"
  | "billing"
  | "settings";

export type DashboardStat =
  | "Total Projects"
  | "Total Scans"
  | "Errors Found"
  | "Warnings Found";

export type DashboardTrendDirection = "up" | "down" | "flat";

export type DashboardStatValue = {
  value: number;
  trend: string;
  trendDirection: DashboardTrendDirection;
};

export type DashboardStatValues = Record<DashboardStat, DashboardStatValue>;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const TREND_WINDOW_DAYS = 30;

async function fetchScans(userId: string) {
  return db
    .select()
    .from(scans)
    .orderBy(desc(scans.createdAt))
    .where(eq(scans.userId, userId));
}

async function fetchGithubPrScans(userId: string) {
  return db
    .select()
    .from(githubPrScans)
    .orderBy(desc(githubPrScans.createdAt))
    .where(eq(githubPrScans.userId, userId));
}

function fetchScanById(scanId: string) {
  return db.select().from(scans).where(eq(scans.scanId, scanId)).limit(1);
}

async function fetchRecentScans(userId: string, amountOfScans: number = 5) {
  return db
    .select()
    .from(scans)
    .orderBy(desc(scans.createdAt))
    .where(eq(scans.userId, userId))
    .limit(amountOfScans);
}

function fetchNotifications(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(10);
}

export async function fetchProjects(userId: string, limit?: number) {
  const [uploadProjects, githubProjects] = await Promise.all([
    db
      .selectDistinctOn([scans.project], {
        project: scans.project,
        status: scans.status,
        score: scans.score,
        errors: scans.errors,
        warnings: scans.warnings,
        createdAt: scans.createdAt,
        scanId: scans.scanId,
        scanPath: scans.scanPath,
      })
      .from(scans)
      .where(eq(scans.userId, userId))
      .orderBy(scans.project, desc(scans.createdAt)),
    db
      .selectDistinctOn([githubPrScans.project], {
        project: githubPrScans.project,
        status: githubPrScans.status,
        score: githubPrScans.score,
        errors: githubPrScans.errors,
        warnings: githubPrScans.warnings,
        createdAt: githubPrScans.createdAt,
        scanId: githubPrScans.scanId,
        repositoryFullName: githubPrScans.repositoryFullName,
        headSha: githubPrScans.headSha,
      })
      .from(githubPrScans)
      .where(eq(githubPrScans.userId, userId))
      .orderBy(githubPrScans.project, desc(githubPrScans.createdAt)),
  ]);

  const merged = [
    ...uploadProjects,
    ...githubProjects.map((scan) => ({
      project: scan.project,
      status: scan.status,
      score: scan.score,
      errors: scan.errors,
      warnings: scan.warnings,
      createdAt: scan.createdAt,
      scanId: scan.scanId,
      scanPath: `github:${scan.repositoryFullName}@${scan.headSha}`,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const latestByProject = new Map<string, (typeof merged)[number]>();
  for (const project of merged) {
    if (!latestByProject.has(project.project)) {
      latestByProject.set(project.project, project);
    }
  }
  const projects = Array.from(latestByProject.values());
  return limit === undefined ? projects : projects.slice(0, limit);
}

function getTrendDirection(value: number): DashboardTrendDirection {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function formatTrend(
  value: number,
  current: number,
  previous: number,
): DashboardStatValue {
  const difference = current - previous;

  return {
    value,
    trend: difference > 0 ? `+${difference}` : difference.toString(),
    trendDirection: getTrendDirection(difference),
  };
}

async function fetchDashboardStats(
  userId: string,
): Promise<DashboardStatValues> {
  const [uploadScans, githubScans] = await Promise.all([
    fetchScans(userId),
    fetchGithubPrScans(userId),
  ]);
  const allScans = [...uploadScans, ...githubScans];
  const now = new Date();
  const currentPeriodStart = new Date(
    now.getTime() - TREND_WINDOW_DAYS * DAY_IN_MILLISECONDS,
  );
  const previousPeriodStart = new Date(
    currentPeriodStart.getTime() - TREND_WINDOW_DAYS * DAY_IN_MILLISECONDS,
  );

  const allProjectsSet = new Set<string>();
  const currentProjects = new Set<string>();
  const previousProjects = new Set<string>();

  const current = {
    "Total Projects": 0,
    "Total Scans": 0,
    "Errors Found": 0,
    "Warnings Found": 0,
  } satisfies Record<DashboardStat, number>;
  const previous = {
    "Total Projects": 0,
    "Total Scans": 0,
    "Errors Found": 0,
    "Warnings Found": 0,
  } satisfies Record<DashboardStat, number>;

  let totalScans = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const scan of allScans) {
    allProjectsSet.add(scan.project);
    totalScans += 1;
    totalErrors += scan.errors;
    totalWarnings += scan.warnings;

    if (scan.createdAt >= currentPeriodStart) {
      currentProjects.add(scan.project);
      current["Total Scans"] += 1;
      current["Errors Found"] += scan.errors;
      current["Warnings Found"] += scan.warnings;
      continue;
    }

    if (
      scan.createdAt >= previousPeriodStart &&
      scan.createdAt < currentPeriodStart
    ) {
      previousProjects.add(scan.project);
      previous["Total Scans"] += 1;
      previous["Errors Found"] += scan.errors;
      previous["Warnings Found"] += scan.warnings;
    }
  }

  current["Total Projects"] = currentProjects.size;
  previous["Total Projects"] = previousProjects.size;

  return {
    "Total Projects": formatTrend(
      allProjectsSet.size,
      current["Total Projects"],
      previous["Total Projects"],
    ),
    "Total Scans": formatTrend(
      totalScans,
      current["Total Scans"],
      previous["Total Scans"],
    ),
    "Errors Found": formatTrend(
      totalErrors,
      current["Errors Found"],
      previous["Errors Found"],
    ),
    "Warnings Found": formatTrend(
      totalWarnings,
      current["Warnings Found"],
      previous["Warnings Found"],
    ),
  };
}

export const getNotifications = cache(fetchNotifications);

export const getScans = cache(fetchScans);
export const getScanById = cache(fetchScanById);

export const getRecentScans = cache(
  unstable_cache(fetchRecentScans, ["dashboard-recent-scans"], {
    tags: ["dashboard-recent-scans", "dashboard"],
    revalidate: DASHBOARD_REVALIDATE_SECONDS,
  }),
);

export const getProjects = cache(
  unstable_cache(fetchProjects, ["dashboard-projects"], {
    tags: ["dashboard-projects", "dashboard"],
    revalidate: DASHBOARD_REVALIDATE_SECONDS,
  }),
);

export const getDashboardStats = cache(
  unstable_cache(fetchDashboardStats, ["dashboard-stats"], {
    tags: ["dashboard-stats", "dashboard"],
    revalidate: DASHBOARD_REVALIDATE_SECONDS,
  }),
);

export type RecentScan = Awaited<ReturnType<typeof getRecentScans>>[number];
export type Notification = Awaited<ReturnType<typeof getNotifications>>[number];
