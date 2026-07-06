import { getCustomer, getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { configureLemonSqueezy } from "@/lib/lemon-squeezy/client";

export async function GET() {
  const user = await getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [currentUser] = await db
    .select({
      lemonsqueezyCustomerId: users.lemonsqueezyCustomerId,
      lemonsqueezySubscriptionId: users.lemonsqueezySubscriptionId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  configureLemonSqueezy();

  if (currentUser?.lemonsqueezySubscriptionId) {
    const { data, error } = await getSubscription(
      currentUser.lemonsqueezySubscriptionId,
    );
    const url = data?.data.attributes.urls.customer_portal;

    if (!error && url) {
      return Response.json({ url });
    }
  }

  if (currentUser?.lemonsqueezyCustomerId) {
    const { data, error } = await getCustomer(
      currentUser.lemonsqueezyCustomerId,
    );
    const url = data?.data.attributes.urls.customer_portal;

    if (!error && url) {
      return Response.json({ url });
    }
  }

  return Response.json(
    { error: "Customer portal unavailable" },
    { status: 404 },
  );
}
