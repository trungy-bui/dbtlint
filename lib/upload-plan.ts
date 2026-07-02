import { eq } from "drizzle-orm";
import db from "@/db";
import { scans, users } from "@/db/schema";
import type { Plan } from "@/lib/plan-limits";

export type UploadPlanState = {
  plan: Plan;
  existingProjects: string[];
};

function normalizePlan(plan: string | null | undefined): Plan {
  return plan === "team" ? "team" : "free";
}

export async function getUploadPlanState(
  userId: string,
): Promise<UploadPlanState> {
  const [currentUser, existingProjects] = await Promise.all([
    db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .selectDistinct({ project: scans.project })
      .from(scans)
      .where(eq(scans.userId, userId)),
  ]);

  return {
    plan: normalizePlan(currentUser[0]?.plan),
    existingProjects: existingProjects.map(({ project }) => project),
  };
}
