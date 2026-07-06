import { cancelSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { configureLemonSqueezy } from "@/lib/lemon-squeezy/client";

function parseLemonDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST() {
  const user = await getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [currentUser] = await db
    .select({ lemonsqueezySubscriptionId: users.lemonsqueezySubscriptionId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!currentUser?.lemonsqueezySubscriptionId) {
    return Response.json({ error: "No subscription found" }, { status: 400 });
  }

  configureLemonSqueezy();

  const { data, error } = await cancelSubscription(
    currentUser.lemonsqueezySubscriptionId,
  );

  if (error || !data) {
    return Response.json(
      { error: "Failed to cancel subscription" },
      { status: 502 },
    );
  }

  const attributes = data.data.attributes;
  const subscriptionRenewsAt = parseLemonDate(
    attributes.ends_at ?? attributes.renews_at,
  );

  await db
    .update(users)
    .set({
      subscriptionStatus: attributes.status,
      subscriptionRenewsAt,
    })
    .where(eq(users.id, user.id));

  return Response.json({ subscriptionStatus: attributes.status });
}
