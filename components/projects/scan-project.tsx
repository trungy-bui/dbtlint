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
      className="group relative flex min-h-11 cursor-pointer flex-col gap-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left transition-colors duration-200 hover:border-slate-700 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      {/* Header: Project name + Status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 flex-1 text-base font-semibold tracking-[-0.02em] text-slate-50">
          {displayName}
        </h3>

        {/* Status Badge */}
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            status === "passed"
              ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : status === "failed"
                ? "border border-rose-400/20 bg-rose-400/10 text-rose-300"
                : "border border-amber-300/20 bg-amber-300/10 text-amber-200"
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
              <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 motion-reduce:animate-none"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Clock className="size-6 animate-pulse text-slate-400 motion-reduce:animate-none" />
              </div>
            </div>
            <span className="font-mono text-xs text-slate-400">Scanning…</span>
          </div>
        ) : (
          <div
            className={`flex size-24 items-center justify-center rounded-full border border-slate-700 bg-gradient-to-br ${scoreBg}`}
          >
            <span
              className={`font-mono text-3xl font-semibold tabular-nums ${scoreColor}`}
            >
              {score}
            </span>
          </div>
        )}
      </div>

      {/* Error & Warning badges */}
      <div className="flex gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-300">
          <AlertCircle className="size-3.5" />
          <span className="font-medium">
            {errors} {errors === 1 ? "error" : "errors"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">
          <AlertTriangle className="size-3.5" />
          <span className="font-medium">
            {warnings} {warnings === 1 ? "warning" : "warnings"}
          </span>
        </div>
      </div>

      {/* Footer: Timestamp */}
      <div className="border-t border-slate-800 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
        {relativeTime}
      </div>
    </button>
  );
}

/**
 * Skeleton variant for loading state
 */
export function ScanProjectCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 motion-reduce:animate-none">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-3/4 rounded bg-slate-700/50"></div>
        <div className="h-6 w-16 rounded-full bg-slate-700/50"></div>
      </div>

      {/* Score circle skeleton */}
      <div className="flex items-center justify-center">
        <div className="size-24 rounded-full bg-slate-700/50"></div>
      </div>

      {/* Stat badges skeleton */}
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded bg-slate-700/50"></div>
        <div className="h-6 w-24 rounded bg-slate-700/50"></div>
      </div>

      {/* Timestamp skeleton */}
      <div className="h-3 w-24 rounded bg-slate-700/50"></div>
    </div>
  );
}
