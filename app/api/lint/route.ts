import { randomUUID } from "node:crypto";
import { auth, tasks } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { deriveProjectName, FREE_PLAN_PROJECT_LIMIT } from "@/lib/plan-limits";
import type { dbtLintTask } from "@/trigger/dbtLintTask";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const rateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 Uploads / Minute
  prefix: "dbtlint:upload",
});

export async function POST(request: Request) {
  try {
    const user = await getUser().catch(() => null);
    const { fileName, filePath } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, reset } = await rateLimit.limit(user.id);
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

    const scanId = randomUUID();

    await db
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
      });

    const project = deriveProjectName(fileName);
    const [currentUser] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (currentUser?.plan !== "team") {
      const existingProjects = await db
        .selectDistinct({ project: scans.project })
        .from(scans)
        .where(eq(scans.userId, user.id));
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
    revalidateTag("dashboard", "max");

    if (!scan) {
      return Response.json({ error: "Failed to create scan" }, { status: 500 });
    }

    const handle = await tasks.trigger<typeof dbtLintTask>("dbt-lint", {
      scanId,
      storageFilePath: filePath,
    });

    const publicAccessToken = await auth.createPublicToken({
      scopes: { read: { runs: [handle.id] } },
    });

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
    return Response.json(
      { error: `Something went wrong, please try again` },
      { status: 500 },
    );
  }
}
