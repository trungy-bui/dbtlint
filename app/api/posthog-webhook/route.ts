import { timingSafeEqual } from "node:crypto";
import { sendDiscordAlert } from "@/lib/discord";

type PostHogWebhookPayload = {
  event?: string;
  event_name?: string;
  distinct_id?: string;
  timestamp?: string;
  url?: string;
  properties?: Record<string, unknown>;
};

const MAX_WEBHOOK_BODY_BYTES = 256 * 1_024;

function commaSeparatedEnvironmentSet(name: string) {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function matchesSecret(request: Request, expectedSecret: string) {
  const authorization = request.headers.get("authorization");
  const providedSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-posthog-webhook-secret");

  if (!providedSecret) return false;

  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function formatProperty(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.POSTHOG_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("POSTHOG_WEBHOOK_SECRET is not configured");
    return Response.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  }

  if (!matchesSecret(request, webhookSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: PostHogWebhookPayload;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    payload = JSON.parse(rawBody) as PostHogWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventName = payload.event ?? payload.event_name;
  if (!eventName) {
    return Response.json({ error: "Missing event name" }, { status: 400 });
  }

  const allowedEvents = commaSeparatedEnvironmentSet(
    "POSTHOG_DISCORD_EVENT_NAMES",
  );
  if (!allowedEvents.has(eventName)) {
    return Response.json({ received: true, forwarded: false });
  }

  const allowedPropertyNames = commaSeparatedEnvironmentSet(
    "POSTHOG_DISCORD_PROPERTY_NAMES",
  );
  const properties = payload.properties ?? {};
  const fields = [...allowedPropertyNames]
    .filter((name) => properties[name] !== undefined)
    .map((name) => ({
      name,
      value: formatProperty(properties[name]),
      inline: true,
    }));

  if (payload.distinct_id) {
    fields.unshift({
      name: "distinct_id",
      value: payload.distinct_id,
      inline: true,
    });
  }

  await sendDiscordAlert({
    title: `PostHog: ${eventName}`,
    description: payload.timestamp
      ? `Important PostHog event received at ${payload.timestamp}.`
      : "Important PostHog event received.",
    level: "info",
    fields,
    url:
      payload.url ??
      (typeof properties.$current_url === "string"
        ? properties.$current_url
        : undefined),
  });

  return Response.json({ received: true, forwarded: true });
}
