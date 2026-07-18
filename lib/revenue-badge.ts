import { createHmac, timingSafeEqual } from "node:crypto";

export const REVENUE_BADGE_EVENTS = [
  "subscription_created",
  "subscription_cancelled",
  "subscription_payment_failed",
] as const;

export type RevenueBadgeEvent = (typeof REVENUE_BADGE_EVENTS)[number];

export type RevenueBadgePayload = {
  event: RevenueBadgeEvent;
  plan: string;
  amount: string;
  account: string;
  metricLabel: string;
  metricValue: string;
  timestamp: string;
};

export const REVENUE_BADGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const REVENUE_BADGE_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export function isRevenueBadgeEvent(value: string): value is RevenueBadgeEvent {
  return REVENUE_BADGE_EVENTS.some((event) => event === value);
}

export function serializeRevenueBadgePayload(payload: RevenueBadgePayload) {
  return new URLSearchParams([
    ["event", payload.event],
    ["plan", payload.plan],
    ["amount", payload.amount],
    ["account", payload.account],
    ["metricLabel", payload.metricLabel],
    ["metricValue", payload.metricValue],
    ["t", payload.timestamp],
  ]);
}

export function signRevenueBadgePayload(
  payload: RevenueBadgePayload,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(serializeRevenueBadgePayload(payload).toString())
    .digest("hex");
}

export function verifyRevenueBadgeSignature({
  payload,
  signature,
  secret,
}: {
  payload: RevenueBadgePayload;
  signature: string;
  secret: string;
}) {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;

  const expected = Buffer.from(signRevenueBadgePayload(payload, secret), "hex");
  const received = Buffer.from(signature, "hex");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
