import { Projects } from "@/components/projects/projects";
import { getUser } from "@/lib/auth";
import { getDashboardStats, getProjects } from "@/lib/dashboard";

export default async function ProjectPage() {
  const user = await getUser();
  if (!user) return;
  const [dashboardStats, dashboardProjects] = await Promise.all([
    getDashboardStats(user.id),
    getProjects(user.id),
  ]);
  const totalProjects = dashboardStats["Total Projects"].value;
  const githubAppSlug = process.env.GITHUB_APP_SLUG ?? "your-github-app-slug";

  return (
    <Projects
      githubInstallUrl={`https://github.com/apps/${githubAppSlug}/installations/new`}
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
