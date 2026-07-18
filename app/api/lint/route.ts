import { randomUUID } from "node:crypto";
import { auth, tasks } from "@trigger.dev/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import {
  deriveProjectName,
  FREE_PLAN_PROJECT_LIMIT,
  FREE_PLAN_SCAN_LIMIT,
} from "@/lib/plan-limits";
import { captureExceptionWithDiscord } from "@/lib/sentry-alert";
import { getCalendarMonthRange } from "@/lib/utils/time";
import type { dbtLintTask } from "@/trigger/dbtLintTask";

const rateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 Uploads / Minute
  prefix: "dbtlint:upload",
});

export async function POST(request: Request) {
  const handlerStart = performance.now();
  let scanId: string | undefined;

  try {
    const user = await getUser().catch(() => null);
    const { fileName, filePath } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rateLimitMs = 0;
    let usersUpsertMs = 0;
    let usersPlanSelectMs = 0;
    let scansProjectSelectMs = 0;
    let scansCountSelectMs = 0;
    let scansInsertMs = 0;
    let tasksTriggerMs = 0;
    let publicTokenMs = 0;

    const rateLimitStart = performance.now();
    const rateLimitPromise = rateLimit.limit(user.id).finally(() => {
      rateLimitMs = performance.now() - rateLimitStart;
    });

    const usersUpsertStart = performance.now();
    const usersUpsertPromise = db
      .insert(users)
      .values({
        id: user.id,
        email: user.email ?? "",
        fullName: user.user_metadata?.full_name ?? user.user_metadata?.name,
        avatarUrl:
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email ?? "",
          fullName: user.user_metadata?.full_name ?? user.user_metadata?.name,
          avatarUrl:
            user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
        },
      })
      .finally(() => {
        usersUpsertMs = performance.now() - usersUpsertStart;
      });

    const usersPlanSelectStart = performance.now();
    const usersPlanSelectPromise = db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .finally(() => {
        usersPlanSelectMs = performance.now() - usersPlanSelectStart;
      });

    const scansProjectSelectStart = performance.now();
    const scansProjectSelectPromise = db
      .selectDistinct({ project: scans.project })
      .from(scans)
      .where(eq(scans.userId, user.id))
      .finally(() => {
        scansProjectSelectMs = performance.now() - scansProjectSelectStart;
      });

    const scansCountSelectStart = performance.now();
    const { monthStart, nextMonthStart } = getCalendarMonthRange();
    const scansCountSelectPromise = db
      .select({ scanCount: count() })
      .from(scans)
      .where(
        and(
          eq(scans.userId, user.id),
          gte(scans.createdAt, monthStart),
          lt(scans.createdAt, nextMonthStart),
        ),
      )
      .finally(() => {
        scansCountSelectMs = performance.now() - scansCountSelectStart;
      });

    const [{ success, reset }, , [currentUser], existingProjects, [scanUsage]] =
      await Promise.all([
        rateLimitPromise,
        usersUpsertPromise,
        usersPlanSelectPromise,
        scansProjectSelectPromise,
        scansCountSelectPromise,
      ]);
    if (!success) {
      return Response.json(
        { error: "Too many uploads, try again shortly", resetAt: reset },
        { status: 429 },
      );
    }

    if (!fileName || !filePath) {
      return Response.json(
        { error: "Missing fileName or filePath" },
        { status: 400 },
      );
    }

    if (!filePath.startsWith(`${user.id}/`)) {
      return Response.json({ error: "Invalid file path" }, { status: 403 });
    }

    scanId = randomUUID();

    const project = deriveProjectName(fileName);

    if (currentUser?.plan !== "team") {
      if ((scanUsage?.scanCount ?? 0) >= FREE_PLAN_SCAN_LIMIT) {
        return Response.json(
          {
            error:
              "Free plan is limited to 5 scans. Upgrade to Team for unlimited scans.",
            code: "SCAN_LIMIT_REACHED",
          },
          { status: 403 },
        );
      }

      const hasExistingProject = existingProjects.some(
        ({ project: existingProject }) => existingProject === project,
      );

      if (
        !hasExistingProject &&
        existingProjects.length >= FREE_PLAN_PROJECT_LIMIT
      ) {
        return Response.json(
          {
            error:
              "Free plan is limited to 1 dbt project. Upgrade to Team for unlimited projects.",
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 403 },
        );
      }
    }

    const scansInsertStart = performance.now();
    const [scan] = await db
      .insert(scans)
      .values({
        id: scanId,
        userId: user.id,
        project,
        scanId,
        scanPath: filePath,
        status: "processing",
        score: 0,
        errors: 0,
        warnings: 0,
      })
      .returning();
    scansInsertMs = performance.now() - scansInsertStart;
    revalidateTag("dashboard", "max");

    if (!scan) {
      return Response.json({ error: "Failed to create scan" }, { status: 500 });
    }

    const tasksTriggerStart = performance.now();
    const handle = await tasks.trigger<typeof dbtLintTask>("dbt-lint", {
      scanId,
      storageFilePath: filePath,
    });
    tasksTriggerMs = performance.now() - tasksTriggerStart;

    const publicTokenStart = performance.now();
    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
    });
    publicTokenMs = performance.now() - publicTokenStart;

    console.log(
      JSON.stringify({
        event: "lint_upload_timing",
        scanId,
        rateLimitMs,
        usersUpsertMs,
        usersPlanSelectMs,
        scansProjectSelectMs,
        scansCountSelectMs,
        scansInsertMs,
        tasksTriggerMs,
        publicTokenMs,
        totalHandlerMs: performance.now() - handlerStart,
      }),
    );

    return Response.json(
      {
        scanId,
        runId: handle.id,
        status: "ongoing",
        publicAccessToken,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    await captureExceptionWithDiscord({
      error,
      title: "Lint API request failed",
      context: { route: "POST /api/lint", scanId },
    });
    return Response.json(
      { error: `Something went wrong, please try again` },
      { status: 500 },
    );
  }
}
