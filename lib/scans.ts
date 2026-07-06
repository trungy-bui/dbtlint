import { and, eq } from "drizzle-orm";
import db from "@/db";
import { scans } from "@/db/schema";

export type ScoreTrendPoint = {
  date: string;
  score: number;
};

function getISOWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getISODayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getISOHourKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00`;
}

export async function getScoreTrend(
  userId: string,
  project: string,
  limit = 30, // Updated default limit to 30 days of data
): Promise<ScoreTrendPoint[]> {
  const rows = await db
    .select({ score: scans.score, createdAt: scans.createdAt })
    .from(scans)
    .where(and(eq(scans.userId, userId), eq(scans.project, project)))
    .orderBy(scans.createdAt);

  const byDay = new Map<string, { score: number; createdAt: Date }>();
  for (const row of rows) {
    byDay.set(getISOHourKey(row.createdAt), {
      score: row.score,
      createdAt: row.createdAt,
    });
  }

  return [...byDay.values()]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({ date: r.createdAt.toISOString(), score: r.score }))
    .slice(-limit);
}
