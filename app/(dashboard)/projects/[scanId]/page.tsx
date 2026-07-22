import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  type ProjectDetail,
  ProjectDetailPanel,
} from "@/components/projects/project-details-panel";
import db from "@/db";
import { githubPrScans, scans } from "@/db/schema";
import { getScoreTrend } from "@/lib/scans";

export default async function ProjectPanelPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;

  const [[uploadScan], [githubScan]] = await Promise.all([
    db.select().from(scans).where(eq(scans.scanId, scanId)).limit(1),
    db
      .select()
      .from(githubPrScans)
      .where(eq(githubPrScans.scanId, scanId))
      .limit(1),
  ]);
  const scan = uploadScan ?? githubScan;

  if (!scan) notFound();

  const scoreHistory = await getScoreTrend(scan.userId, scan.project);

  const data: ProjectDetail = {
    project: scan.project,
    status: scan.status as ProjectDetail["status"],
    score: scan.score,
    errors: scan.errors,
    warnings: scan.warnings,
    createdAt: scan.createdAt.toISOString(),
    ...(scan.report ? { report: scan.report } : {}),
    scoreHistory,
  };

  return <ProjectDetailPanel data={data} />;
}
