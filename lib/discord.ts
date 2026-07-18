import * as Sentry from "@sentry/nextjs";

export type DiscordAlertLevel = "error" | "warning" | "info" | "success";

export type DiscordAlertField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordAlertAuthor = {
  name: string;
  iconUrl?: string;
};

type SendDiscordAlertInput = {
  title: string;
  description: string;
  level: DiscordAlertLevel;
  fields?: DiscordAlertField[] | Record<string, unknown>;
  url?: string;
  author?: DiscordAlertAuthor;
  thumbnailUrl?: string;
  imageUrl?: string;
  footer?: string;
  footerIconUrl?: string;
};

const DISCORD_COLORS: Record<DiscordAlertLevel, number> = {
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  success: 0x57f287,
};

const DISCORD_TIMEOUT_MS = 5_000;

function truncate(value: string, maximumLength: number) {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength - 1)}…`;
}

function stringifyFieldValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeFields(
  fields: SendDiscordAlertInput["fields"],
): DiscordAlertField[] {
  const normalized = Array.isArray(fields)
    ? fields
    : Object.entries(fields ?? {}).map(([name, value]) => ({
        name,
        value: stringifyFieldValue(value),
        inline: true,
      }));

  return normalized.slice(0, 25).map((field) => ({
    name: truncate(field.name || "Context", 256),
    value: truncate(field.value || "-", 1_024),
    inline: field.inline,
  }));
}

function normalizeEmbedUrl(url: string | undefined) {
  if (!url) return undefined;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
      ? parsedUrl.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Sends a best-effort Discord notification and never rejects. */
export async function sendDiscordAlert({
  title,
  description,
  level,
  fields,
  url,
  author,
  thumbnailUrl,
  imageUrl,
  footer,
  footerIconUrl,
}: SendDiscordAlertInput): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const normalizedThumbnailUrl = normalizeEmbedUrl(thumbnailUrl);
  const normalizedImageUrl = normalizeEmbedUrl(imageUrl);
  const normalizedFooterIconUrl = normalizeEmbedUrl(footerIconUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            author: author
              ? {
                  name: truncate(author.name, 256),
                  icon_url: normalizeEmbedUrl(author.iconUrl),
                }
              : undefined,
            title: truncate(title, 256),
            description: truncate(description, 4_096),
            color: DISCORD_COLORS[level],
            fields: normalizeFields(fields),
            url: normalizeEmbedUrl(url),
            thumbnail: normalizedThumbnailUrl
              ? { url: normalizedThumbnailUrl }
              : undefined,
            image: normalizedImageUrl ? { url: normalizedImageUrl } : undefined,
            footer: footer
              ? {
                  text: truncate(footer, 2_048),
                  icon_url: normalizedFooterIconUrl,
                }
              : undefined,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Discord webhook returned ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Failed to send Discord alert", {
      error,
      alertTitle: title,
      alertLevel: level,
    });
    Sentry.captureException(error, {
      tags: { notification_provider: "discord" },
      extra: { alertTitle: title, alertLevel: level },
    });
  } finally {
    clearTimeout(timeout);
  }
}
