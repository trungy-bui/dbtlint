import { eq } from "drizzle-orm";
import db from "@/db";
import { githubInstallations } from "@/db/schema";

export async function getInstallationUserId(installationId: number) {
  const [installation] = await db
    .select({ userId: githubInstallations.userId })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, String(installationId)))
    .limit(1);

  return installation?.userId ?? null;
}
