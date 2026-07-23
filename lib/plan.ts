import { and, count, eq, gte, lt } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import db from "@/db";
import { githubPrScans, scans, users } from "@/db/schema";
import type { Plan } from "@/lib/plan-limits";
import { getCalendarMonthRange } from "@/lib/utils/time";

export async function getUserPlan(userId: string): Promise<Plan> {
  const [currentUser] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return currentUser?.plan === "team" ? "team" : "free";
}

export async function getCombinedScanUsage(userId: string): Promise<number> {
  const { monthStart, nextMonthStart } = getCalendarMonthRange();
  const usageBySource = await unionAll(
    db
      .select({ scanCount: count() })
      .from(scans)
      .where(
        and(
          eq(scans.userId, userId),
          gte(scans.createdAt, monthStart),
          lt(scans.createdAt, nextMonthStart),
        ),
      ),
    db
      .select({ scanCount: count() })
      .from(githubPrScans)
      .where(
        and(
          eq(githubPrScans.userId, userId),
          gte(githubPrScans.createdAt, monthStart),
          lt(githubPrScans.createdAt, nextMonthStart),
        ),
      ),
  );

  return usageBySource.reduce((total, usage) => total + usage.scanCount, 0);
}
