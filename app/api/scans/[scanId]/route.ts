import { and, eq } from "drizzle-orm";
import db from "@/db";
import { githubPrScans, scans } from "@/db/schema";
import { getUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ scanId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await context.params;
  const [[uploadScan], [githubScan]] = await Promise.all([
    db
      .select({
        scanId: scans.scanId,
        status: scans.status,
        score: scans.score,
        errors: scans.errors,
        warnings: scans.warnings,
        report: scans.report,
      })
      .from(scans)
      // Ownership is enforced in both queries so scan IDs cannot expose other users' results.
      .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)))
      .limit(1),
    db
      .select({
        scanId: githubPrScans.scanId,
        status: githubPrScans.status,
        score: githubPrScans.score,
        errors: githubPrScans.errors,
        warnings: githubPrScans.warnings,
        report: githubPrScans.report,
      })
      .from(githubPrScans)
      .where(
        and(
          eq(githubPrScans.scanId, scanId),
          eq(githubPrScans.userId, user.id),
        ),
      )
      .limit(1),
  ]);
  const scan = uploadScan ?? githubScan;

  if (!scan) {
    return Response.json({ error: "Scan not found" }, { status: 404 });
  }

  return Response.json(scan, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
