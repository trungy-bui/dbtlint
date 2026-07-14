import { and, count, eq, gte, lt } from "drizzle-orm";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";
import { getCalendarMonthRange } from "@/lib/utils/time";

type UserPlan = "free" | "team";

type UserPlanResponse = {
  plan: UserPlan | null;
  email: string | null;
  subscriptionStatus: string | null;
  nextBillingDate: string | null;
  scansUsed: number | null;
  scansLimit: number | null;
};

export async function GET() {
  const user = await getUser();

  if (!user) {
    return Response.json({
      plan: null,
      email: null,
      subscriptionStatus: null,
      nextBillingDate: null,
      scansUsed: null,
      scansLimit: null,
    } satisfies UserPlanResponse);
  }

  try {
    const { monthStart, nextMonthStart } = getCalendarMonthRange();

    const [[currentUser], [scanUsage]] = await Promise.all([
      db
        .select({
          plan: users.plan,
          email: users.email,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionRenewsAt: users.subscriptionRenewsAt,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1),
      db
        .select({ scanCount: count() })
        .from(scans)
        .where(
          and(
            eq(scans.userId, user.id),
            gte(scans.createdAt, monthStart),
            lt(scans.createdAt, nextMonthStart),
          ),
        ),
    ]);

    const plan: UserPlan = currentUser?.plan === "team" ? "team" : "free";

    return Response.json({
      plan,
      email: currentUser?.email ?? user.email ?? null,
      subscriptionStatus: currentUser?.subscriptionStatus ?? null,
      nextBillingDate: currentUser?.subscriptionRenewsAt?.toISOString() ?? null,
      scansUsed: plan === "team" ? null : (scanUsage?.scanCount ?? 0),
      scansLimit: plan === "team" ? null : FREE_PLAN_SCAN_LIMIT,
    } satisfies UserPlanResponse);
  } catch (error) {
    console.error("Failed to fetch user plan", { error, userId: user.id });
    return Response.json(
      {
        plan: null,
        email: null,
        subscriptionStatus: null,
        nextBillingDate: null,
        scansUsed: null,
        scansLimit: null,
      } satisfies UserPlanResponse,
      {
        status: 500,
      },
    );
  }
}
