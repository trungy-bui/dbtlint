import { ImageResponse } from "next/og";
import {
  isRevenueBadgeEvent,
  REVENUE_BADGE_CLOCK_SKEW_MS,
  REVENUE_BADGE_MAX_AGE_MS,
  type RevenueBadgeEvent,
  type RevenueBadgePayload,
  verifyRevenueBadgeSignature,
} from "@/lib/revenue-badge";

const BADGE_WIDTH = 600;
const BADGE_HEIGHT = 300;

type RevenueTier = {
  status: string;
  label: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
};

const REVENUE_TIERS: Record<RevenueBadgeEvent, RevenueTier> = {
  subscription_created: {
    status: "NEW SUBSCRIPTION",
    label: "Revenue gained",
    accent: "#34D399",
    background: "#064E3B",
    surface: "#052E2B",
    border: "#10B981",
  },
  subscription_cancelled: {
    status: "CANCELLED",
    label: "Subscription ending",
    accent: "#FBBF24",
    background: "#78350F",
    surface: "#451A03",
    border: "#F59E0B",
  },
  subscription_payment_failed: {
    status: "PAYMENT FAILED",
    label: "Payment at risk",
    accent: "#FB7185",
    background: "#881337",
    surface: "#4C0519",
    border: "#F43F5E",
  },
};

function invalidBadge(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function hasValidLengths(payload: RevenueBadgePayload) {
  return (
    payload.plan.length > 0 &&
    payload.plan.length <= 80 &&
    payload.amount.length > 0 &&
    payload.amount.length <= 32 &&
    payload.account.length > 0 &&
    payload.account.length <= 32 &&
    payload.metricLabel.length > 0 &&
    payload.metricLabel.length <= 24 &&
    payload.metricValue.length > 0 &&
    payload.metricValue.length <= 80
  );
}

function truncate(value: string, maximumLength: number) {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength - 1)}…`;
}

export async function GET(request: Request) {
  const secret = process.env.REVENUE_BADGE_SECRET;
  if (!secret) return invalidBadge(503, "Badge signing is not configured");

  const url = new URL(request.url);
  const event = url.searchParams.get("event") ?? "";
  const signature = url.searchParams.get("sig") ?? "";

  if (!isRevenueBadgeEvent(event)) {
    return invalidBadge(400, "Unsupported revenue event");
  }

  const payload: RevenueBadgePayload = {
    event,
    plan: url.searchParams.get("plan") ?? "",
    amount: url.searchParams.get("amount") ?? "",
    account: url.searchParams.get("account") ?? "",
    metricLabel: url.searchParams.get("metricLabel") ?? "",
    metricValue: url.searchParams.get("metricValue") ?? "",
    timestamp: url.searchParams.get("t") ?? "",
  };

  if (!hasValidLengths(payload)) {
    return invalidBadge(400, "Invalid badge content");
  }

  const timestamp = Number(payload.timestamp);
  const age = Date.now() - timestamp;

  if (
    !Number.isFinite(timestamp) ||
    age < -REVENUE_BADGE_CLOCK_SKEW_MS ||
    age > REVENUE_BADGE_MAX_AGE_MS
  ) {
    return invalidBadge(401, "Badge URL has expired");
  }

  if (!verifyRevenueBadgeSignature({ payload, signature, secret })) {
    return invalidBadge(401, "Invalid badge signature");
  }

  const tier = REVENUE_TIERS[event];
  const amountLabel =
    event === "subscription_cancelled" ? "ORIGINAL AMOUNT" : "AMOUNT";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 18,
        color: "#FAFAFA",
        backgroundColor: tier.background,
        backgroundImage: `linear-gradient(135deg, ${tier.background}, #09090B 72%)`,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "24px 28px",
          border: `1px solid ${tier.border}`,
          borderRadius: 22,
          backgroundColor: tier.surface,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 7,
            height: "100%",
            display: "flex",
            backgroundColor: tier.accent,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#D4D4D8",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.14em",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                display: "flex",
                borderRadius: 999,
                backgroundColor: tier.accent,
              }}
            />
            DBTLINT
          </div>

          <div
            style={{
              display: "flex",
              padding: "7px 12px",
              color: tier.accent,
              border: `1px solid ${tier.border}`,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            {tier.status}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#A1A1AA",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              ACCOUNT
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 330,
                color: "#FAFAFA",
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              {truncate(payload.account, 28)}
            </div>
            <div
              style={{
                display: "flex",
                color: tier.accent,
                fontSize: 15,
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {truncate(payload.plan, 42)} · {tier.label}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#A1A1AA",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              {amountLabel}
            </div>
            <div
              style={{
                display: "flex",
                color: tier.accent,
                fontSize: 68,
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: "-0.05em",
              }}
            >
              {truncate(payload.amount, 14)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "PLAN", value: payload.plan },
            { label: payload.metricLabel, value: payload.metricValue },
          ].map((metric) => (
            <div
              key={metric.label}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                border: "1px solid rgba(255, 255, 255, 0.10)",
                borderRadius: 12,
                backgroundColor: "rgba(9, 9, 11, 0.42)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#A1A1AA",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {truncate(metric.label, 20)}
              </div>
              <div
                style={{
                  display: "flex",
                  color: tier.accent,
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                {truncate(metric.value, 26)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    {
      width: BADGE_WIDTH,
      height: BADGE_HEIGHT,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
