import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import db from "@/db";
import { scans } from "@/db/schema";

const BADGE_WIDTH = 600;
const BADGE_HEIGHT = 300;

type ScoreTier = {
  label: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
};

const PROCESSING_TIER: ScoreTier = {
  label: "Scan running",
  accent: "#A1A1AA",
  background: "#27272A",
  surface: "#18181B",
  border: "#52525B",
};

function getScoreTier(score: number): ScoreTier {
  if (score >= 90) {
    return {
      label: "Excellent",
      accent: "#34D399",
      background: "#064E3B",
      surface: "#052E2B",
      border: "#10B981",
    };
  }

  if (score >= 70) {
    return {
      label: "Good",
      accent: "#38BDF8",
      background: "#164E63",
      surface: "#082F49",
      border: "#0EA5E9",
    };
  }

  if (score >= 50) {
    return {
      label: "Needs work",
      accent: "#FBBF24",
      background: "#78350F",
      surface: "#451A03",
      border: "#F59E0B",
    };
  }

  return {
    label: "Poor",
    accent: "#FB7185",
    background: "#881337",
    surface: "#4C0519",
    border: "#F43F5E",
  };
}

function truncateProjectName(project: string) {
  return project.length <= 42 ? project : `${project.slice(0, 41)}…`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await context.params;

  // Discord fetches embed images without the user's application session.
  // Expose only the non-sensitive summary identified by the UUID scan ID.
  const [scan] = await db
    .select({
      project: scans.project,
      status: scans.status,
      score: scans.score,
      errors: scans.errors,
      warnings: scans.warnings,
    })
    .from(scans)
    .where(eq(scans.scanId, scanId))
    .limit(1);

  if (!scan) {
    return Response.json(
      { error: "Scan not found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const isProcessing = scan.status === "processing";
  const tier = isProcessing ? PROCESSING_TIER : getScoreTier(scan.score);
  const statusLabel = isProcessing
    ? "PROCESSING"
    : scan.status === "passed"
      ? "PASSED"
      : "FAILED";

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
            {statusLabel}
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
              PROJECT
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 355,
                color: "#FAFAFA",
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              {truncateProjectName(scan.project)}
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
              {tier.label}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              color: tier.accent,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: "-0.06em",
              }}
            >
              {isProcessing ? "—" : scan.score}
            </div>
            {!isProcessing && (
              <div
                style={{
                  display: "flex",
                  color: "#A1A1AA",
                  fontSize: 20,
                  fontWeight: 700,
                  marginLeft: 7,
                }}
              >
                /100
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
          }}
        >
          {[
            { label: "ERRORS", value: scan.errors, color: "#FB7185" },
            { label: "WARNINGS", value: scan.warnings, color: "#FBBF24" },
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
                {metric.label}
              </div>
              <div
                style={{
                  display: "flex",
                  color: metric.color,
                  fontSize: 25,
                  fontWeight: 900,
                }}
              >
                {metric.value}
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
        "Cache-Control": isProcessing
          ? "no-store, max-age=0"
          : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
