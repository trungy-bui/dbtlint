import { eq } from "drizzle-orm";
import { Projects } from "@/components/projects/projects";
import db from "@/db";
import { githubInstallations } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getDashboardStats, getProjects } from "@/lib/dashboard";
import { getUserPlan } from "@/lib/plan";

export default async function ProjectPage() {
  const user = await getUser();
  if (!user) return;
  const [dashboardStats, dashboardProjects, githubInstallationRows, plan] =
    await Promise.all([
      getDashboardStats(user.id),
      getProjects(user.id),
      db
        .select({ accountLogin: githubInstallations.accountLogin })
        .from(githubInstallations)
        .where(eq(githubInstallations.userId, user.id))
        .limit(1),
      getUserPlan(user.id),
    ]);
  const [githubInstallation] = githubInstallationRows;
  const totalProjects = dashboardStats["Total Projects"].value;
  const githubAppSlug = process.env.GITHUB_APP_SLUG ?? "your-github-app-slug";

  return (
    <Projects
      githubAccountLogin={githubInstallation?.accountLogin ?? null}
      githubConnected={Boolean(githubInstallation)}
      githubInstallUrl={`https://github.com/apps/${githubAppSlug}/installations/new`}
      plan={plan}
      projects={dashboardProjects.map((project) => ({
        ...project,
        status: project.status as "processing" | "passed" | "failed",
        createdAt:
          project.createdAt instanceof Date
            ? project.createdAt.toISOString()
            : project.createdAt,
      }))}
      totalProjects={totalProjects}
    />
  );
}
