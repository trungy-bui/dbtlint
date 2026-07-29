import { eq } from "drizzle-orm";
import { Projects } from "@/components/projects/projects";
import db from "@/db";
import { githubInstallations } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getDashboardStats, getProjects } from "@/lib/dashboard";
import { getUserPlan } from "@/lib/plan";
import { uploadedZipExists } from "@/lib/uploaded-zip-storage";

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
  const projects = await Promise.all(
    dashboardProjects.map(async (project) => ({
      ...project,
      canRerun:
        project.source === "upload"
          ? await uploadedZipExists(project.scanPath)
          : true,
      status: project.status as "processing" | "passed" | "failed",
      createdAt:
        project.createdAt instanceof Date
          ? project.createdAt.toISOString()
          : project.createdAt,
    })),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="terminal-label text-emerald-400">Project registry</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
          Projects
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Review scan history, compare quality scores, and manage connected dbt
          projects.
        </p>
      </header>
      <Projects
        githubAccountLogin={githubInstallation?.accountLogin ?? null}
        githubConnected={Boolean(githubInstallation)}
        githubInstallUrl={`https://github.com/apps/${githubAppSlug}/installations/new`}
        plan={plan}
        projects={projects}
        totalProjects={totalProjects}
      />
    </div>
  );
}
