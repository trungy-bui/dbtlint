import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";

export async function getScanningUser(userId: string) {
  try {
    const [user] = await db
      .select({
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  } catch (error) {
    console.error("Failed to load scanning user for Discord alert", {
      error,
      userId,
    });
    Sentry.captureException(error, {
      tags: { notification_provider: "discord" },
      extra: { userId },
    });
    return null;
  }
}
