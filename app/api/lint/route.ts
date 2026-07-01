import { randomUUID } from "node:crypto";
import { auth, tasks } from "@trigger.dev/sdk";
import { revalidateTag } from "next/cache";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import type { dbtLintTask } from "@/trigger/dbtLintTask";

export async function POST(request: Request) {
  try {
    const user = await getUser().catch(() => null);
    const { fileName, filePath } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!fileName || !filePath) {
      return Response.json(
        { error: "Missing fileName or filePath" },
        { status: 400 },
      );
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

    const [scan] = await db
      .insert(scans)
      .values({
        id: scanId,
        userId: user.id,
        project: fileName.replace(".zip", ""),
        scanId,
        scanPath: filePath,
        status: "ongoing",
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
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
