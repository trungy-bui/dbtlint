import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth";

type UserPlan = "free" | "team";

type UserPlanResponse = {
  plan: UserPlan | null;
};

export async function GET() {
  const user = await getUser();

  if (!user) {
    return Response.json({ plan: null } satisfies UserPlanResponse);
  }

  try {
    const [currentUser] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return Response.json({
      plan: currentUser?.plan === "team" ? "team" : "free",
    } satisfies UserPlanResponse);
  } catch (error) {
    console.error("Failed to fetch user plan", { error, userId: user.id });
    return Response.json({ plan: null } satisfies UserPlanResponse, {
      status: 500,
    });
  }
}
