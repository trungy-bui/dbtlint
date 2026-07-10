"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import db from "@/db";
import { notifications } from "@/db/schema";
import { getUser } from "@/lib/auth";

export async function markNotificationsAsRead(notificationIds?: string[]) {
  const user = await getUser();
  if (!user) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
        notificationIds && notificationIds.length > 0
          ? inArray(notifications.id, notificationIds)
          : undefined,
      ),
    );

  revalidateTag("dashboard-notifications", "max");
}