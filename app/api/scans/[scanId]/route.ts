import { and, eq } from "drizzle-orm";
import db from "@/db";
import { scans } from "@/db/schema";
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
  const [scan] = await db
    .select({
      scanId: scans.scanId,
      status: scans.status,
      score: scans.score,
      errors: scans.errors,
      warnings: scans.warnings,
      report: scans.report,
    })
    .from(scans)
    // Ownership is enforced in the query so scan IDs cannot expose other users' results.
    .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)))
    .limit(1);

  if (!scan) {
    return Response.json({ error: "Scan not found" }, { status: 404 });
  }

  return Response.json(scan, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
