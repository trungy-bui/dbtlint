import { createHmac, timingSafeEqual } from "node:crypto";
import { getOrder } from "@lemonsqueezy/lemonsqueezy.js";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { sendDiscordAlert } from "@/lib/discord";
import { configureLemonSqueezy } from "@/lib/lemon-squeezy/client";

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
      status_formatted?: string;
      customer_id?: string | number;
      order_id?: string | number;
      product_name?: string;
      variant_name?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      total_formatted?: string;
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

type RevenueAlertEvent =
  | "subscription_created"
  | "subscription_cancelled"
  | "subscription_payment_failed";

async function getOrderAmount(orderId: string | number | undefined) {
  if (!orderId) return "Unavailable";

  configureLemonSqueezy();
  const { data, error } = await getOrder(orderId);

  if (error) {
    console.error("Failed to retrieve Lemon Squeezy order for revenue alert", {
      error,
      orderId,
    });
    return "Unavailable";
  }

  return data?.data.attributes.total_formatted ?? "Unavailable";
}

async function sendRevenueAlert({
  eventName,
  userId,
  productName,
  variantName,
  orderId,
  invoiceAmount,
  subscriptionStatus,
  subscriptionEndsAt,
}: {
  eventName: RevenueAlertEvent;
  userId: string;
  productName?: string;
  variantName?: string;
  orderId?: string | number;
  invoiceAmount?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string | null;
}) {
  const webhookUrl = process.env.DISCORD_REVENUE_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const [account] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const planName =
      [productName, variantName].filter(Boolean).join(" — ") || "Team";
    const accountName = account?.fullName ?? userId;

    if (eventName === "subscription_created") {
      await sendDiscordAlert({
        webhookUrl,
        title: "New Team subscription",
        description: "A customer upgraded to the Team plan.",
        level: "success",
        fields: [
          { name: "Plan", value: planName, inline: true },
          {
            name: "Amount",
            value: await getOrderAmount(orderId),
            inline: true,
          },
          { name: "Account", value: accountName },
        ],
      });
      return;
    }

    if (eventName === "subscription_cancelled") {
      await sendDiscordAlert({
        webhookUrl,
        title: "Team subscription cancelled",
        description: "A customer cancelled their Team subscription.",
        level: "warning",
        fields: [
          { name: "Plan", value: planName, inline: true },
          { name: "Account", value: accountName },
          {
            name: "Access ends",
            value: subscriptionEndsAt ?? "Unavailable",
          },
        ],
      });
      return;
    }

    await sendDiscordAlert({
      webhookUrl,
      title: "Subscription payment failed",
      description: "A Team subscription payment could not be processed.",
      level: "error",
      fields: [
        { name: "Account", value: accountName },
        { name: "Amount", value: invoiceAmount ?? "Unavailable", inline: true },
        {
          name: "Status",
          value: subscriptionStatus ?? "payment_failed",
          inline: true,
        },
      ],
    });
  } catch (error) {
    console.error("Failed to prepare Discord revenue alert", {
      error,
      eventName,
      userId,
    });
    Sentry.captureException(error, {
      tags: { notification_provider: "discord", alert_type: "revenue" },
      extra: { eventName, userId },
    });
  }
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
    Sentry.captureException(error);
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
  const productName = payload.data?.attributes?.product_name;
  const variantName = payload.data?.attributes?.variant_name;
  const orderId = payload.data?.attributes?.order_id;
  const invoiceAmount = payload.data?.attributes?.total_formatted;
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
        await sendRevenueAlert({
          eventName,
          userId,
          productName,
          variantName,
          orderId,
          subscriptionStatus,
        });
        break;

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
        await sendRevenueAlert({
          eventName,
          userId,
          productName,
          variantName,
          subscriptionStatus,
          subscriptionEndsAt: payload.data?.attributes?.ends_at,
        });
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
        await sendRevenueAlert({
          eventName,
          userId,
          invoiceAmount,
          subscriptionStatus:
            payload.data?.attributes?.status_formatted ?? "Payment failed",
        });
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
    Sentry.captureException(error);
  }

  return Response.json({ received: true });
}
