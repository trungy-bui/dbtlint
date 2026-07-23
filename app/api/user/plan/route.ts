import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getCombinedScanUsage } from "@/lib/plan";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";

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
    const [[currentUser], scansUsed] = await Promise.all([
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
      getCombinedScanUsage(user.id),
    ]);

    const plan: UserPlan = currentUser?.plan === "team" ? "team" : "free";

    return Response.json({
      plan,
      email: currentUser?.email ?? user.email ?? null,
      subscriptionStatus: currentUser?.subscriptionStatus ?? null,
      nextBillingDate: currentUser?.subscriptionRenewsAt?.toISOString() ?? null,
      scansUsed: plan === "team" ? null : scansUsed,
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
