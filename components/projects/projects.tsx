"use client";

import {
  CheckCircle2,
  CircleAlert,
  GitPullRequest,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScanStatusPolling } from "@/hooks/use-scan-status-polling";
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
  githubAccountLogin: string | null;
  githubConnected: boolean;
  githubInstallUrl: string;
}

type StatusFilter = "all" | ProjectScan["status"];
type GitHubResult =
  | "already_connected"
  | "connected"
  | "error"
  | "invalid_setup"
  | "updated";
type SortOption =
  | "newest"
  | "oldest"
  | "score-asc"
  | "score-desc"
  | "errors-desc";

const STATUS_OPTIONS: Array<{
  value: StatusFilter;
  label: string;
  dotClassName: string;
}> = [
  { value: "all", label: "All", dotClassName: "bg-slate-400" },
  { value: "passed", label: "Passed", dotClassName: "bg-emerald-400" },
  { value: "failed", label: "Failed", dotClassName: "bg-rose-400" },
  { value: "processing", label: "Processing", dotClassName: "bg-amber-300" },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "score-asc", label: "Lowest score first" },
  { value: "score-desc", label: "Highest score first" },
  { value: "errors-desc", label: "Most errors first" },
];

function isStatusFilter(value: string | null): value is StatusFilter {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

function isSortOption(value: string | null): value is SortOption {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function isGitHubResult(value: string | null): value is GitHubResult {
  return (
    value === "already_connected" ||
    value === "connected" ||
    value === "error" ||
    value === "invalid_setup" ||
    value === "updated"
  );
}

export function Projects({
  githubAccountLogin,
  githubConnected,
  githubInstallUrl,
  projects,
  totalProjects,
}: ProjectsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status");
  const initialSort = searchParams.get("sort");
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState<StatusFilter>(
    isStatusFilter(initialStatus) ? initialStatus : "all",
  );
  const [sort, setSort] = useState<SortOption>(
    isSortOption(initialSort) ? initialSort : "newest",
  );
  const [currentProjects, setCurrentProjects] = useState(projects);
  const githubResultParam = searchParams.get("github");
  const [githubResult, setGithubResult] = useState<GitHubResult | null>(null);
  const processingScanIds = useMemo(
    () =>
      currentProjects
        .filter((project) => project.status === "processing")
        .map((project) => project.scanId),
    [currentProjects],
  );
  const scanStatuses = useScanStatusPolling(processingScanIds);

  useEffect(() => {
    setCurrentProjects(
      projects.map((project) => {
        const scan = scanStatuses[project.scanId];
        return scan
          ? {
              ...project,
              status: scan.status,
              score: scan.score,
              errors: scan.errors,
              warnings: scan.warnings,
            }
          : project;
      }),
    );
  }, [projects, scanStatuses]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedSearch = debouncedSearch.trim();

    if (normalizedSearch) params.set("q", normalizedSearch);
    else params.delete("q");

    if (status !== "all") params.set("status", status);
    else params.delete("status");

    if (sort !== "newest") params.set("sort", sort);
    else params.delete("sort");

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;

    if (query !== searchParams.toString()) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [debouncedSearch, pathname, router, searchParams, sort, status]);

  useEffect(() => {
    if (!isGitHubResult(githubResultParam)) return;

    setGithubResult(githubResultParam);
    const timeout = window.setTimeout(() => {
      setGithubResult(null);
      const params = new URLSearchParams(window.location.search);
      params.delete("github");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }, 6_000);

    return () => window.clearTimeout(timeout);
  }, [githubResultParam, pathname, router]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase();
    const matches = currentProjects.filter(
      (project) =>
        (status === "all" || project.status === status) &&
        (!normalizedSearch ||
          project.project.toLocaleLowerCase().includes(normalizedSearch)),
    );

    return matches.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return Date.parse(a.createdAt) - Date.parse(b.createdAt);
        case "score-asc":
          return a.score - b.score;
        case "score-desc":
          return b.score - a.score;
        case "errors-desc":
          return b.errors - a.errors;
        default:
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }
    });
  }, [currentProjects, debouncedSearch, sort, status]);

  const hasActiveFilters =
    debouncedSearch.trim() !== "" || status !== "all" || sort !== "newest";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setSort("newest");

    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("status");
    params.delete("sort");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function dismissGithubResult() {
    setGithubResult(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("github");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const githubButton = (
    <Button
      asChild
      variant="outline"
      className={
        githubConnected
          ? "h-10 cursor-pointer border-emerald-400/30 bg-emerald-400/10 px-4 text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-100 focus-visible:ring-emerald-400"
          : "h-10 cursor-pointer border-slate-700 bg-slate-950/60 px-4 text-slate-100 hover:bg-slate-800 hover:text-white focus-visible:ring-emerald-400"
      }
    >
      <Link href={githubInstallUrl}>
        {githubConnected ? (
          <CheckCircle2 data-icon="inline-start" />
        ) : (
          <GitPullRequest data-icon="inline-start" />
        )}
        {githubConnected
          ? githubAccountLogin
            ? `Connected as ${githubAccountLogin}`
            : "GitHub Connected"
          : "Connect GitHub"}
      </Link>
    </Button>
  );

  if (totalProjects === 0) {
    return (
      <div className="space-y-4">
        {githubResult && (
          <GitHubConnectionNotice
            result={githubResult}
            onDismiss={dismissGithubResult}
          />
        )}
        <div className="flex justify-end">{githubButton}</div>
        <EmptyProjects onUpload={() => router.push("/upload")} />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-100">
      {githubResult && (
        <GitHubConnectionNotice
          result={githubResult}
          onDismiss={dismissGithubResult}
        />
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="project-search" className="sr-only">
            Search projects
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
          />
          <Input
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="h-10 border-slate-800 bg-slate-900 pr-3 pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger
            aria-label="Filter projects by status"
            className="h-10 w-full border-slate-800 bg-slate-900 text-slate-200 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30 sm:w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border border-slate-800 bg-slate-900 text-slate-200">
            {STATUS_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="focus:bg-slate-800 focus:text-slate-50"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${option.dotClassName}`}
                />
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) => setSort(value as SortOption)}
        >
          <SelectTrigger
            aria-label="Sort projects"
            className="h-10 w-full border-slate-800 bg-slate-900 text-slate-200 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30 sm:w-48"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border border-slate-800 bg-slate-900 text-slate-200">
            {SORT_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="focus:bg-slate-800 focus:text-slate-50"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {githubButton}
      </div>

      {hasActiveFilters && (
        <p className="text-sm text-slate-400" aria-live="polite">
          Showing {filteredProjects.length} of {totalProjects} projects
        </p>
      )}

      {filteredProjects.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
          <div className="space-y-1">
            <h2 className="font-semibold text-slate-100">
              No projects match your filters
            </h2>
            <p className="text-sm text-slate-400">
              Try another search or reset the current filters.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            className="cursor-pointer border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-slate-50 focus-visible:ring-emerald-400"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProjects.map((p) => (
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
      )}
    </div>
  );
}

function GitHubConnectionNotice({
  onDismiss,
  result,
}: {
  onDismiss: () => void;
  result: GitHubResult;
}) {
  const isSuccess = result === "connected" || result === "updated";
  const message = {
    already_connected:
      "This GitHub installation is already connected to another account.",
    connected: "GitHub was connected successfully.",
    error: "We couldn't connect GitHub. Please try again.",
    invalid_setup:
      "GitHub returned an invalid installation setup. Please try again.",
    updated: "GitHub repository access was updated.",
  }[result];

  return (
    <output
      aria-live="polite"
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-rose-400/20 bg-rose-400/10 text-rose-200"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss GitHub connection message"
        className="cursor-pointer rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </output>
  );
}
