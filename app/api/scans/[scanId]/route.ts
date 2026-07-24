import { tasks } from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import db from "@/db";
import { githubPrScans, scans } from "@/db/schema";
import { getUser } from "@/lib/auth";
import {
  deleteUploadedZip,
  uploadedZipExists,
} from "@/lib/uploaded-zip-storage";
import type { dbtLintTask } from "@/trigger/dbtLintTask";
import type { githubLintTask } from "@/trigger/githubLintTask";

type RouteContext = { params: Promise<{ scanId: string }> };

function isValidProjectName(project: unknown): project is string {
  return (
    typeof project === "string" &&
    project.trim().length > 0 &&
    project.trim().length <= 120
  );
}

export async function GET(_request: Request, context: RouteContext) {
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

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    project?: unknown;
  } | null;

  if (!body || !isValidProjectName(body.project)) {
    return Response.json(
      { error: "Project name must be between 1 and 120 characters" },
      { status: 400 },
    );
  }

  const project = body.project.trim();
  const [updatedScan] = await db
    .update(scans)
    .set({ project })
    .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)))
    .returning({ project: scans.project });

  if (!updatedScan) {
    return Response.json({ error: "Manual scan not found" }, { status: 404 });
  }

  revalidateTag("dashboard", "max");
  return Response.json(updatedScan);
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await context.params;
  const [[uploadScan], [githubScan]] = await Promise.all([
    db
      .select({
        scanPath: scans.scanPath,
        status: scans.status,
      })
      .from(scans)
      .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)))
      .limit(1),
    db
      .select({
        installationId: githubPrScans.installationId,
        repositoryFullName: githubPrScans.repositoryFullName,
        prNumber: githubPrScans.prNumber,
        headSha: githubPrScans.headSha,
        status: githubPrScans.status,
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
  if (scan.status === "processing") {
    return Response.json(
      { error: "This scan is already running" },
      { status: 409 },
    );
  }

  if (uploadScan) {
    if (!(await uploadedZipExists(uploadScan.scanPath))) {
      return Response.json(
        { error: "The original upload is no longer available" },
        { status: 409 },
      );
    }

    await tasks.trigger<typeof dbtLintTask>("dbt-lint", {
      scanId,
      storageFilePath: uploadScan.scanPath,
    });
  } else if (githubScan) {
    const installationId = Number(githubScan.installationId);
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      return Response.json(
        { error: "The stored GitHub installation is invalid" },
        { status: 409 },
      );
    }

    await tasks.trigger<typeof githubLintTask>("github-lint", {
      installationId,
      repoFullName: githubScan.repositoryFullName,
      prNumber: githubScan.prNumber,
      headSha: githubScan.headSha,
    });
  }

  revalidateTag("dashboard", "max");
  return Response.json({ status: "processing" }, { status: 202 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await context.params;
  const [[uploadScan], [githubScan]] = await Promise.all([
    db
      .select({ scanPath: scans.scanPath })
      .from(scans)
      .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)))
      .limit(1),
    db
      .select({ scanId: githubPrScans.scanId })
      .from(githubPrScans)
      .where(
        and(
          eq(githubPrScans.scanId, scanId),
          eq(githubPrScans.userId, user.id),
        ),
      )
      .limit(1),
  ]);

  if (!uploadScan && !githubScan) {
    return Response.json({ error: "Scan not found" }, { status: 404 });
  }

  if (uploadScan) {
    await deleteUploadedZip(uploadScan.scanPath);
    await db
      .delete(scans)
      .where(and(eq(scans.scanId, scanId), eq(scans.userId, user.id)));
  } else {
    await db
      .delete(githubPrScans)
      .where(
        and(
          eq(githubPrScans.scanId, scanId),
          eq(githubPrScans.userId, user.id),
        ),
      );
  }

  revalidateTag("dashboard", "max");
  return new Response(null, { status: 204 });
}
