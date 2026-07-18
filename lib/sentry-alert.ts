import * as Sentry from "@sentry/nextjs";
import {
  type DiscordAlertField,
  type DiscordAlertLevel,
  sendDiscordAlert,
} from "@/lib/discord";

type CaptureExceptionWithDiscordInput = {
  error: unknown;
  title?: string;
  level?: DiscordAlertLevel;
  context?: Record<string, unknown>;
};

const LEVEL_PRIORITY: Record<DiscordAlertLevel, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

function shouldSendLevel(level: DiscordAlertLevel) {
  const configuredLevel = process.env.SENTRY_DISCORD_MIN_LEVEL?.toLowerCase();
  if (configuredLevel === "off") return false;

  const minimumLevel =
    configuredLevel && configuredLevel in LEVEL_PRIORITY
      ? (configuredLevel as DiscordAlertLevel)
      : "error";

  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimumLevel];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatContextValue(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function getSentryEventUrl(eventId: string) {
  const issuesUrl = process.env.SENTRY_ISSUES_URL;
  if (!issuesUrl) return undefined;

  try {
    const url = new URL(issuesUrl);
    url.searchParams.set("query", eventId);
    return url.toString();
  } catch {
    return undefined;
  }
}

function contextFields(context: Record<string, unknown> | undefined) {
  return Object.entries(context ?? {}).map<DiscordAlertField>(
    ([name, value]) => ({
      name,
      value: formatContextValue(value),
      inline: true,
    }),
  );
}

/** Captures in Sentry, then sends a best-effort Discord alert for enabled levels. */
export async function captureExceptionWithDiscord({
  error,
  title = "Application error",
  level = "error",
  context,
}: CaptureExceptionWithDiscordInput): Promise<string> {
  const eventId = Sentry.captureException(error, {
    tags: Object.fromEntries(
      Object.entries(context ?? {})
        .filter(([, value]) =>
          ["string", "number", "boolean"].includes(typeof value),
        )
        .map(([key, value]) => [key, String(value)]),
    ),
    extra: context,
    level: level === "warning" ? "warning" : level,
  });

  if (shouldSendLevel(level)) {
    const sentryUrl = getSentryEventUrl(eventId);
    await sendDiscordAlert({
      title,
      description: getErrorMessage(error),
      level,
      fields: [
        ...contextFields(context),
        { name: "Sentry event ID", value: eventId, inline: false },
      ],
      url: sentryUrl,
    });
  }

  return eventId;
}
