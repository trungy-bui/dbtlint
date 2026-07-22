import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import db from "@/db";
import { githubInstallations } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getAppJwt, getInstallationToken } from "@/lib/github/app-auth";

const SETUP_ACTIONS = new Set(["install", "update"]);

function redirectToProjects(request: Request, result: string) {
  const url = new URL("/projects", request.url);
  url.searchParams.set("github", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const user = await getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", new URL(request.url).pathname);
    return NextResponse.redirect(loginUrl);
  }

  const searchParams = new URL(request.url).searchParams;
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  if (
    !installationId ||
    !/^\d+$/.test(installationId) ||
    !setupAction ||
    !SETUP_ACTIONS.has(setupAction)
  ) {
    return redirectToProjects(request, "invalid_setup");
  }

  try {
    const appOctokit = new Octokit({ auth: await getAppJwt() });
    const installationOctokit = new Octokit({
      auth: await getInstallationToken(installationId),
    });

    const [{ data: installation }, repositories] = await Promise.all([
      appOctokit.rest.apps.getInstallation({
        installation_id: Number(installationId),
      }),
      installationOctokit.paginate(
        installationOctokit.rest.apps.listReposAccessibleToInstallation,
        { per_page: 100 },
      ),
    ]);

    const accountLogin =
      installation.account && "login" in installation.account
        ? installation.account.login
        : null;
    const repositoryList = repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.full_name,
    }));
    const [existingInstallation] = await db
      .select({ userId: githubInstallations.userId })
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId))
      .limit(1);

    if (existingInstallation && existingInstallation.userId !== user.id) {
      console.warn("GitHub installation is already connected to another user", {
        installationId,
        userId: user.id,
      });
      return redirectToProjects(request, "already_connected");
    }

    await db
      .insert(githubInstallations)
      .values({
        userId: user.id,
        installationId,
        accountLogin,
        repositories: repositoryList,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: {
          accountLogin,
          repositories: repositoryList,
          updatedAt: new Date(),
        },
      });

    return redirectToProjects(
      request,
      setupAction === "update" ? "updated" : "connected",
    );
  } catch (error) {
    console.error("Failed to save GitHub App installation", {
      error,
      installationId,
      userId: user.id,
    });
    return redirectToProjects(request, "error");
  }
}
