"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

interface ScanProjectCardProps {
  project: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  createdAt: string;
  scanId: string;
  scanPath: string;
  onClick?: () => void;
}

/**
 * Get relative time string (e.g., "2 hours ago", "Just now")
 * Simple implementation without external date library
 */
function getRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600)
    return `${Math.floor(diffSeconds / 60)} minute${Math.floor(diffSeconds / 60) > 1 ? "s" : ""} ago`;
  if (diffSeconds < 86400)
    return `${Math.floor(diffSeconds / 3600)} hour${Math.floor(diffSeconds / 3600) > 1 ? "s" : ""} ago`;
  if (diffSeconds < 604800)
    return `${Math.floor(diffSeconds / 86400)} day${Math.floor(diffSeconds / 86400) > 1 ? "s" : ""} ago`;

  return `${Math.floor(diffSeconds / 604800)} week${Math.floor(diffSeconds / 604800) > 1 ? "s" : ""} ago`;
}

/**
 * Extract readable project name from path (strip extensions/prefixes)
 */
function getProjectName(projectPath: string): string {
  // Remove .zip extension if present
  let name = projectPath.replace(/\.zip$/, "");
  // Remove common prefixes like timestamps
  name = name.replace(/^\d+-/, "");
  // Replace hyphens with spaces for readability
  return name.replace(/-/g, " ");
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

/**
 * Get score background gradient based on value
 */
function getScoreBgGradient(score: number): string {
  if (score >= 80) return "from-emerald-500/20 to-emerald-500/10";
  if (score >= 50) return "from-amber-500/20 to-amber-500/10";
  return "from-red-500/20 to-red-500/10";
}

export function ScanProjectCard({
  project,
  status,
  score,
  errors,
  warnings,
  createdAt,
  onClick,
}: ScanProjectCardProps) {
  const isProcessing = status === "processing";
  const relativeTime = getRelativeTime(createdAt);
  const displayName = getProjectName(project);
  const scoreColor = getScoreColor(score);
  const scoreBg = getScoreBgGradient(score);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all duration-200 hover:border-zinc-700 hover:shadow-lg hover:shadow-emerald-500/10"
    >
      {/* Header: Project name + Status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 text-sm font-semibold text-zinc-50 line-clamp-2">
          {displayName}
        </h3>

        {/* Status Badge */}
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            status === "passed"
              ? "bg-emerald-500/20 text-emerald-300"
              : status === "failed"
                ? "bg-red-500/20 text-red-300"
                : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {status === "passed" && <CheckCircle2 className="size-3.5" />}
          {status === "failed" && <XCircle className="size-3.5" />}
          {status === "processing" && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          <span className="capitalize">{status}</span>
        </div>
      </div>

      {/* Score Display or Processing State */}
      <div className="flex items-center justify-center">
        {isProcessing ? (
          <div className="flex items-center justify-center gap-3">
            <div className="relative size-16">
              <div className="absolute inset-0 rounded-full border-2 border-zinc-700"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className="size-6 text-zinc-400 animate-pulse" />
              </div>
            </div>
            <span className="text-sm text-zinc-400">Scanning...</span>
          </div>
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${scoreBg} border border-zinc-700`}
          >
            <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
          </div>
        )}
      </div>

      {/* Error & Warning badges */}
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 rounded px-2.5 py-1 bg-red-500/10 text-xs text-red-300">
          <AlertCircle className="size-3.5" />
          <span className="font-medium">
            {errors} {errors === 1 ? "error" : "errors"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded px-2.5 py-1 bg-amber-500/10 text-xs text-amber-300">
          <AlertTriangle className="size-3.5" />
          <span className="font-medium">
            {warnings} {warnings === 1 ? "warning" : "warnings"}
          </span>
        </div>
      </div>

      {/* Footer: Timestamp */}
      <div className="text-xs text-zinc-500">{relativeTime}</div>
    </button>
  );
}

/**
 * Skeleton variant for loading state
 */
export function ScanProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-3/4 rounded bg-zinc-700/50"></div>
        <div className="h-6 w-16 rounded-full bg-zinc-700/50"></div>
      </div>

      {/* Score circle skeleton */}
      <div className="flex items-center justify-center">
        <div className="size-24 rounded-full bg-zinc-700/50"></div>
      </div>

      {/* Stat badges skeleton */}
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded bg-zinc-700/50"></div>
        <div className="h-6 w-24 rounded bg-zinc-700/50"></div>
      </div>

      {/* Timestamp skeleton */}
      <div className="h-3 w-24 rounded bg-zinc-700/50"></div>
    </div>
  );
}
