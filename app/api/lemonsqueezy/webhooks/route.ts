import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { captureExceptionWithDiscord } from "@/lib/sentry-alert";

type LemonSqueezyWebhookPayload = {
  meta?: {
    event_name?: string;
    test_mode?: boolean;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      customer_id?: string | number;
      renews_at?: string | null;
      ends_at?: string | null;
    };
  };
};

function parseLemonDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidSignature({
  body,
  signature,
  secret,
}: {
  body: string;
  signature: string | null;
  secret: string | undefined;
}) {
  if (!signature || !secret) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const digestBuffer = Buffer.from(digest, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(digestBuffer, signatureBuffer);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (
    !isValidSignature({
      body: rawBody,
      signature,
      secret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    })
  ) {
    console.warn("Invalid or missing Lemon Squeezy webhook signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LemonSqueezyWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
  } catch (error) {
    console.error(
      "Failed to parse verified Lemon Squeezy webhook payload",
      error,
    );
    await captureExceptionWithDiscord({
      error,
      title: "Lemon Squeezy webhook parse failed",
      context: { route: "POST /api/lemonsqueezy/webhooks" },
    });
    return Response.json({ received: true });
  }

  const eventName = payload.meta?.event_name;
  // const { meta } = payload;
  // if (meta?.test_mode && process.env.NODE_ENV === "production") {
  //   console.log("Ignoring test-mode webhook in production", { eventName });
  //   return Response.json({ received: true });
  // }

  const userId = payload.meta?.custom_data?.user_id;
  const subscriptionStatus = payload.data?.attributes?.status;
  const subscriptionId = payload.data?.id;
  const customerId = payload.data?.attributes?.customer_id;
  const subscriptionRenewsAt = parseLemonDate(
    payload.data?.attributes?.ends_at ?? payload.data?.attributes?.renews_at,
  );

  if (!userId) {
    console.warn(
      "Lemon Squeezy webhook received with no user_id in custom_data",
      { eventName },
    );
    return Response.json({ received: true });
  }

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_resumed":
      case "subscription_unpaused":
      case "subscription_payment_success":
        await db
          .update(users)
          .set({
            plan: "team",
            subscriptionStatus,
            subscriptionRenewsAt,
            lemonsqueezyCustomerId:
              customerId === undefined ? undefined : String(customerId),
            lemonsqueezySubscriptionId: subscriptionId,
          })
          .where(eq(users.id, userId));
        break;

      case "subscription_cancelled":
        await db
          .update(users)
          .set({ subscriptionStatus, subscriptionRenewsAt })
          .where(eq(users.id, userId));
        break;
      case "subscription_expired":
        await db
          .update(users)
          .set({ plan: "free", subscriptionStatus, subscriptionRenewsAt })
          .where(eq(users.id, userId));
        break;

      case "subscription_payment_failed":
        await db
          .update(users)
          .set({ subscriptionStatus: "payment_failed" })
          .where(eq(users.id, userId));
        break;

      case "subscription_paused":
        await db
          .update(users)
          .set({ subscriptionStatus: "paused" })
          .where(eq(users.id, userId));
        break;

      case "subscription_payment_refunded":
        await db
          .update(users)
          .set({ plan: "free", subscriptionStatus: "refunded" })
          .where(eq(users.id, userId));
        break;

      default:
        console.log("Unhandled Lemon Squeezy webhook event", { eventName });
        break;
    }
  } catch (error) {
    console.error("Failed to update user from Lemon Squeezy webhook", {
      error,
      eventName,
      userId,
      subscriptionId,
      customerId,
    });
    await captureExceptionWithDiscord({
      error,
      title: "Lemon Squeezy subscription update failed",
      context: {
        route: "POST /api/lemonsqueezy/webhooks",
        eventName,
        userId,
        subscriptionId,
      },
    });
  }

  return Response.json({ received: true });
}
