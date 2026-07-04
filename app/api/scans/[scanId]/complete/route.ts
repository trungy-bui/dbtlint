import { eq } from "drizzle-orm";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { ScanCompleteEmail } from "@/emails/ScanCompleteEmail";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: Request,
  context: { params: Promise<{ scanId: string }> },
) {
  const completionSecret = process.env.SCAN_COMPLETE_WEBHOOK_SECRET;
  const authorization = request.headers.get("authorization");

  if (!completionSecret) {
    return Response.json(
      { error: "SCAN_COMPLETE_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (authorization !== `Bearer ${completionSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await context.params;

  const [scan] = await db
    .select({
      project: scans.project,
      scanId: scans.scanId,
      score: scans.score,
      status: scans.status,
      email: users.email,
    })
    .from(scans)
    .innerJoin(users, eq(scans.userId, users.id))
    .where(eq(scans.scanId, scanId))
    .limit(1);

  if (!scan) {
    return Response.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status === "processing") {
    return Response.json(
      { error: "Scan has not finished yet" },
      { status: 409 },
    );
  }

  const resultsUrl = new URL(
    `/projects/${scan.scanId}`,
    request.url,
  ).toString();

  await sendEmail({
    to: scan.email,
    subject: `Your ${scan.project} scan is complete`,
    react: ScanCompleteEmail({
      projectName: scan.project,
      resultsUrl,
      score: scan.score,
    }),
  });

  return Response.json({ sent: true });
}
