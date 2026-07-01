import { desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import db from "@/db";
import { scans } from "@/db/schema";

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

async function fetchRecentScans(userId: string, amountOfScans: number = 5) {
  return db
    .select()
    .from(scans)
    .orderBy(desc(scans.createdAt))
    .where(eq(scans.userId, userId))
    .limit(amountOfScans);
}

export async function fetchProjects(userId: string) {
  return db
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
    .orderBy(scans.project, desc(scans.createdAt));
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
  const allScans = await fetchScans(userId);
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

export const getScans = cache(fetchScans);

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
