"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Image,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ScanAction = "rename" | "rerun" | "delete";

interface ScanProjectCardProps {
  project: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  createdAt: string;
  scanId: string;
  source: "upload" | "github";
  repositoryFullName: string | null;
  prNumber: number | null;
  canRerun: boolean;
  menuOpen: boolean;
  pendingAction?: ScanAction;
  onClick?: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRename: (project: string) => Promise<boolean>;
  onRerun: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function getRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  const weeks = Math.floor(diffSeconds / 604800);
  return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
}

function getProjectName(projectPath: string): string {
  let name = projectPath.replace(/\.zip$/, "");
  name = name.replace(/^\d+-/, "");
  return name.replace(/-/g, " ");
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function getScoreBgGradient(score: number): string {
  if (score >= 80) return "from-emerald-500/20 to-emerald-500/10";
  if (score >= 50) return "from-amber-500/20 to-amber-500/10";
  return "from-red-500/20 to-red-500/10";
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export function ScanProjectCard({
  project,
  status,
  score,
  errors,
  warnings,
  createdAt,
  scanId,
  source,
  repositoryFullName,
  prNumber,
  canRerun,
  menuOpen,
  pendingAction,
  onClick,
  onMenuOpenChange,
  onRename,
  onRerun,
  onDelete,
}: ScanProjectCardProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextProjectName, setNextProjectName] = useState(project);
  const isProcessing = status === "processing";
  const isBusy = pendingAction !== undefined;
  const displayName =
    source === "github" && repositoryFullName && prNumber !== null
      ? `${repositoryFullName} #${prNumber}`
      : getProjectName(project);
  const rerunUnavailable = source === "upload" && !canRerun;

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const renamed = await onRename(nextProjectName);
    if (renamed) setRenameOpen(false);
  }

  function openRenameDialog() {
    setNextProjectName(project);
    setRenameOpen(true);
  }

  const rerunItem = (
    <DropdownMenuItem
      disabled={isBusy || isProcessing}
      aria-disabled={rerunUnavailable || undefined}
      onSelect={(event) => {
        if (rerunUnavailable) {
          event.preventDefault();
          return;
        }
        void onRerun();
      }}
      className={
        rerunUnavailable
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer focus:bg-slate-800 focus:text-slate-50"
      }
    >
      {pendingAction === "rerun" ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Play aria-hidden="true" />
      )}
      Re-run scan
    </DropdownMenuItem>
  );

  return (
    <>
      <article className="group relative flex min-h-11 flex-col gap-5 rounded-2xl border border-surface-border bg-surface-card p-5 text-left shadow-[0_18px_48px_rgba(2,6,23,0.2),inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-emerald-400/35 hover:bg-slate-900 hover:shadow-[0_20px_54px_rgba(2,6,23,0.3),0_0_0_1px_rgba(52,211,153,0.06)] motion-reduce:transition-none">
        <button
          type="button"
          onClick={onClick}
          aria-label={`Open scan details for ${displayName}`}
          className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />

        <div className="pointer-events-none relative z-10 flex items-start gap-3">
          <h3
            title={displayName}
            className="min-w-0 flex-1 text-base font-semibold tracking-[-0.02em] text-slate-50"
          >
            <span aria-hidden="true" className="line-clamp-2">
              {displayName}
            </span>
            <span className="sr-only">{displayName}</span>
          </h3>

          <div className="flex w-36 shrink-0 items-center justify-end gap-1.5">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                status === "passed"
                  ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : status === "failed"
                    ? "border border-rose-400/20 bg-rose-400/10 text-rose-300"
                    : "border border-amber-300/20 bg-amber-300/10 text-amber-200"
              }`}
            >
              {status === "passed" && (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              )}
              {status === "failed" && (
                <XCircle className="size-3.5" aria-hidden="true" />
              )}
              {status === "processing" && (
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              <span className="capitalize">{status}</span>
            </div>

            <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More actions for ${displayName}`}
                  className="pointer-events-auto relative z-20 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-50 focus-visible:ring-emerald-400"
                >
                  <MoreVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={8}
                avoidCollisions
                collisionPadding={12}
                className="pointer-events-auto z-50 min-w-52 border border-slate-800 bg-slate-900 p-1.5 text-slate-200 shadow-xl duration-150 ease-out data-[side=bottom]:data-closed:slide-out-to-top-2 data-[side=top]:data-closed:slide-out-to-bottom-2 data-closed:ease-in motion-reduce:duration-0 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
              >
                {source === "upload" && (
                  <DropdownMenuItem
                    onSelect={openRenameDialog}
                    disabled={isBusy}
                    className="cursor-pointer focus:bg-slate-800 focus:text-slate-50"
                  >
                    <Pencil aria-hidden="true" />
                    Rename
                  </DropdownMenuItem>
                )}

                {rerunUnavailable ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{rerunItem}</TooltipTrigger>
                    <TooltipContent side="left">
                      The original upload has already been removed.
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  rerunItem
                )}

                {source === "github" &&
                  repositoryFullName &&
                  prNumber !== null && (
                    <DropdownMenuItem asChild>
                      <a
                        href={`https://github.com/${repositoryFullName}/pull/${prNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer focus:bg-slate-800 focus:text-slate-50"
                      >
                        <ExternalLink aria-hidden="true" />
                        View on GitHub
                      </a>
                    </DropdownMenuItem>
                  )}

                <DropdownMenuItem
                  onSelect={() =>
                    void copyToClipboard(
                      `${window.location.origin}/projects/${encodeURIComponent(scanId)}`,
                      "Scan link",
                    )
                  }
                  className="cursor-pointer focus:bg-slate-800 focus:text-slate-50"
                >
                  <Copy aria-hidden="true" />
                  Copy scan link
                </DropdownMenuItem>

                {source === "upload" && (
                  <DropdownMenuItem
                    onSelect={() =>
                      void copyToClipboard(
                        `${window.location.origin}/api/scans/${encodeURIComponent(scanId)}/badge`,
                        "Badge URL",
                      )
                    }
                    className="cursor-pointer focus:bg-slate-800 focus:text-slate-50"
                  >
                    <Image aria-hidden="true" />
                    Copy badge URL
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isBusy}
                  onSelect={() => setDeleteOpen(true)}
                  className="cursor-pointer text-rose-400 focus:bg-rose-400/10 focus:text-rose-300"
                >
                  {pendingAction === "delete" ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 aria-hidden="true" />
                  )}
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="pointer-events-none relative z-10 flex items-center justify-center">
          {isProcessing ? (
            <div className="flex items-center justify-center gap-3">
              <div className="relative size-16">
                <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 motion-reduce:animate-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock
                    className="size-6 animate-pulse text-slate-400 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <span className="font-mono text-xs text-slate-400">
                Scanning…
              </span>
            </div>
          ) : (
            <div
              className={`flex size-24 items-center justify-center rounded-full border border-slate-700 bg-gradient-to-br ${getScoreBgGradient(score)}`}
            >
              <span
                className={`font-mono text-3xl font-semibold tabular-nums ${getScoreColor(score)}`}
              >
                {score}
              </span>
            </div>
          )}
        </div>

        <div className="pointer-events-none relative z-10 flex gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-300">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            <span className="font-medium">
              {errors} {errors === 1 ? "error" : "errors"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            <span className="font-medium">
              {warnings} {warnings === 1 ? "warning" : "warnings"}
            </span>
          </div>
        </div>

        <div className="pointer-events-none relative z-10 border-t border-surface-border pt-3 font-mono text-[10px] tracking-[0.1em] text-slate-400 uppercase">
          {getRelativeTime(createdAt)}
        </div>
      </article>

      {source === "upload" && (
        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent className="border border-slate-800 bg-slate-900 text-slate-100">
            <form onSubmit={handleRename} className="contents">
              <DialogHeader>
                <DialogTitle>Rename project</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Choose the name shown on your Projects dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label
                  htmlFor={`rename-${scanId}`}
                  className="text-sm font-medium"
                >
                  Project name
                </label>
                <Input
                  id={`rename-${scanId}`}
                  value={nextProjectName}
                  onChange={(event) => setNextProjectName(event.target.value)}
                  maxLength={120}
                  autoFocus
                  required
                  disabled={pendingAction === "rename"}
                  className="border-slate-700 bg-slate-950 text-slate-100 focus-visible:border-emerald-400 focus-visible:ring-emerald-400/30"
                />
              </div>
              <DialogFooter className="border-slate-800 bg-slate-950/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRenameOpen(false)}
                  disabled={pendingAction === "rename"}
                  className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    pendingAction === "rename" ||
                    nextProjectName.trim().length === 0
                  }
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  {pendingAction === "rename" && (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  )}
                  Save name
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border border-slate-800 bg-slate-900 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scan?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-slate-800 bg-slate-950/50">
            <AlertDialogCancel
              disabled={pendingAction === "delete"}
              className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingAction === "delete"}
              onClick={() => void onDelete()}
            >
              {pendingAction === "delete" && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Delete scan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ScanProjectCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 motion-reduce:animate-none">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 w-3/4 rounded bg-slate-700/50" />
        <div className="h-6 w-16 rounded-full bg-slate-700/50" />
      </div>
      <div className="flex items-center justify-center">
        <div className="size-24 rounded-full bg-slate-700/50" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded bg-slate-700/50" />
        <div className="h-6 w-24 rounded bg-slate-700/50" />
      </div>
      <div className="h-3 w-24 rounded bg-slate-700/50" />
    </div>
  );
}
