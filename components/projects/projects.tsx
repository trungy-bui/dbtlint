"use client";

import { redirect, useRouter } from "next/navigation";
import { EmptyProjects } from "./empty-projects";
import { ScanProjectCard } from "./scan-project";

interface ProjectScan {
  project: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  createdAt: string;
  scanId: string;
  scanPath: string;
}

interface ProjectsProps {
  totalProjects: number;
  projects: ProjectScan[];
}

export function Projects({ projects, totalProjects }: ProjectsProps) {
  const router = useRouter();

  return totalProjects === 0 ? (
    <EmptyProjects onUpload={() => router.push("/upload")} />
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projects.map((p) => (
        <ScanProjectCard
          key={p.scanId}
          project={p.project}
          status={p.status}
          score={p.score}
          errors={p.errors}
          warnings={p.warnings}
          createdAt={p.createdAt}
          scanId={p.scanId}
          scanPath={p.scanPath}
          onClick={() => router.push(`/projects/${p.scanId}`)}
        />
      ))}
    </div>
  );
}
