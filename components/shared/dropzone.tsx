"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  Loader2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUser } from "@/lib/auth";
import {
  deriveProjectName,
  FREE_PLAN_PROJECT_LIMIT,
  type Plan,
} from "@/lib/plan-limits";
import { usePlanUsage } from "@/lib/plan-usage-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { LintMetadata } from "@/lib/validation/lint";
import type { dbtLintTask } from "@/trigger/dbtLintTask";

const PLAN_LIMIT_REACHED_CODE = "PLAN_LIMIT_REACHED";
const SCAN_LIMIT_REACHED_CODE = "SCAN_LIMIT_REACHED";
const RECOGNIZED_RUN_STATUSES = new Set([
  "QUEUED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
]);
const TERMINAL_RUN_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELED"]);
const SCAN_STATUS_POLL_INTERVAL_MS = 9_000;
const SCAN_STATUS_STALL_TIMEOUT_MS = 15_000;

type ScanStatusResponse = {
  scanId: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  report: LintMetadata["report"] | null;
};

type BlockReason = "project-limit" | "scan-limit";

type UploadZoneProps = {
  className?: string;
  compact?: boolean;
  plan?: Plan;
  existingProjects?: string[];
  scanCount?: number;
};

type ScanItem = {
  id: string;
  file: File;
  fileName: string;
  runId: string | null;
  scanId: string | null;
  accessToken: string | null;
  isSubmitting: boolean;
  projectName: string;
  blockReason: BlockReason | null;
};

export function UploadZone({
  className,
  compact = false,
  existingProjects = [],
}: UploadZoneProps) {
  const { plan, scansUsed, scansLimit, bumpScansUsed } = usePlanUsage();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [scans, setScans] = React.useState<ScanItem[]>([]);
  const [isLintingAll, setIsLintingAll] = React.useState(false);
  const [isLimitBannerDismissed, setIsLimitBannerDismissed] =
    React.useState(false);
  const existingProjectSet = React.useMemo(
    () => new Set(existingProjects),
    [existingProjects],
  );
  const blockedReason = scans.find((scan) => scan.blockReason)?.blockReason;
  const queuedRunnableScanCount = scans.filter(
    (scan) => scan.blockReason === null && scan.runId === null,
  ).length;
  const hasReachedFreeScanLimit =
    plan === "free" && scansUsed + queuedRunnableScanCount >= scansLimit;
  const hasReachedFreeScanLimitStrict =
    plan === "free" && scansUsed >= scansLimit;
  const hasBlockedScans = scans.some((scan) => scan.blockReason !== null);
  const eligibleQueuedScans = scans.filter(
    (scan) => scan.blockReason === null && scan.runId === null,
  );

  React.useEffect(() => {
    if (!hasReachedFreeScanLimitStrict) return;

    setScans((prev) => {
      let hasChanged = false;
      const next = prev.map((scan) => {
        if (scan.blockReason !== null || scan.runId !== null) return scan;

        hasChanged = true;
        return { ...scan, blockReason: "scan-limit" as const };
      });

      return hasChanged ? next : prev;
    });
    setIsLimitBannerDismissed(false);
  }, [hasReachedFreeScanLimitStrict]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const queuedProjectNames = new Set(scans.map((scan) => scan.projectName));
    const queuedNewProjectNames = new Set(
      scans
        .filter(
          (scan) =>
            scan.blockReason !== "project-limit" &&
            !existingProjectSet.has(scan.projectName),
        )
        .map((scan) => scan.projectName),
    );

    const newItems: ScanItem[] = Array.from(files)
      .filter((f) => f.name.toLowerCase().endsWith(".zip"))
      .flatMap((f) => {
        const projectName = deriveProjectName(f.name);

        if (queuedProjectNames.has(projectName)) {
          return [];
        }

        queuedProjectNames.add(projectName);

        const isNewProject = !existingProjectSet.has(projectName);
        const wouldExceedProjectLimit =
          plan === "free" &&
          isNewProject &&
          existingProjects.length + queuedNewProjectNames.size >=
            FREE_PLAN_PROJECT_LIMIT;
        const blockReason: BlockReason | null = hasReachedFreeScanLimit
          ? "scan-limit"
          : wouldExceedProjectLimit
            ? "project-limit"
            : null;

        if (!blockReason && isNewProject) {
          queuedNewProjectNames.add(projectName);
        }

        return [
          {
            id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2)}`,
            file: f,
            fileName: f.name,
            runId: null,
            scanId: null,
            accessToken: null,
            isSubmitting: false,
            projectName,
            blockReason,
          },
        ];
      });

    if (newItems.some((item) => item.blockReason !== null)) {
      setIsLimitBannerDismissed(false);
    }

    setScans((prev) => [...prev, ...newItems]);
  };

  const handleRunLint = async (id: string) => {
    const item = scans.find((s) => s.id === id);
    if (!item || item.blockReason) return;
    if (plan === "free" && scansUsed >= scansLimit) {
      setScans((prev) =>
        prev.map((scan) =>
          scan.id === id ? { ...scan, blockReason: "scan-limit" } : scan,
        ),
      );
      setIsLimitBannerDismissed(false);
      return;
    }
    const setSubmitting = (isSubmitting: boolean) => {
      setScans((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isSubmitting } : s)),
      );
    };

    setScans((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              isSubmitting: true,
              runId: null,
              scanId: null,
              accessToken: null,
            }
          : s,
      ),
    );

    try {
      const user = await getUser();
      if (!user) {
        setSubmitting(false);
        return;
      }
      const supabase = createClient();
      const fileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}-${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dbt-uploads")
        .upload(filePath, item.file);

      if (uploadError || !uploadData) {
        console.error("Upload failed:", uploadError);
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: item.file.name,
          filePath: uploadData.path,
        }),
      });

      const data = await response.json();

      if (
        response.status === 403 &&
        (data?.code === PLAN_LIMIT_REACHED_CODE ||
          data?.code === SCAN_LIMIT_REACHED_CODE)
      ) {
        setIsLimitBannerDismissed(false);
        setScans((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  isSubmitting: false,
                  blockReason:
                    data?.code === SCAN_LIMIT_REACHED_CODE
                      ? "scan-limit"
                      : "project-limit",
                }
              : s,
          ),
        );
        return;
      }

      if (response.status === 429) {
        toast.error(
          "You're uploading too quickly. Please wait a moment before trying again.",
        );
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        console.error("Lint request failed:", data);
        setSubmitting(false);
        return;
      }

      setScans((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                runId: data.runId,
                scanId: data.scanId,
                accessToken: data.publicAccessToken,
              }
            : s,
        ),
      );
      bumpScansUsed(1);
    } catch (error) {
      console.log(error);
      setSubmitting(false);
    }
  };

  const handleRunAll = async () => {
    const eligibleIds = eligibleQueuedScans.map((scan) => scan.id);
    if (eligibleIds.length <= 1) return;

    setIsLintingAll(true);
    try {
      await Promise.all(eligibleIds.map((id) => handleRunLint(id)));
    } finally {
      setIsLintingAll(false);
    }
  };

  const handleClear = (id: string) => {
    setScans((prev) => prev.filter((s) => s.id !== id));
  };

  const dropzone = (
    <Button
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/55 text-center text-slate-100 outline-none transition-colors duration-200",
        "hover:border-emerald-400/50 hover:bg-emerald-400/[0.04] focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/30",
        isDragging && "border-emerald-400 bg-emerald-400/10",
        compact
          ? "min-h-[220px] px-6 py-10"
          : "min-h-[400px] px-6 py-16 md:min-h-[480px] lg:min-h-[360px]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          // reset so selecting the same file again still fires onChange
          e.target.value = "";
        }}
      />
      <motion.div
        animate={{ y: isDragging ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex size-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
      >
        <UploadCloud className="size-6" />
      </motion.div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-100">
          Drop your dbt ZIP files here or{" "}
          <span className="text-emerald-400">click to browse</span>
        </p>
        <p className="max-w-full whitespace-normal px-4 font-mono text-[11px] leading-relaxed text-slate-500">
          Supports .zip archives up to 50MB, multiple files allowed
        </p>
      </div>
    </Button>
  );

  const limitBannerCopy =
    blockedReason === "scan-limit"
      ? {
          title: "Free plan scan limit reached",
          body: "Upgrade to Team to rescan this project.",
          dismissLabel: "Dismiss scan limit warning",
        }
      : {
          title: "Free plan project limit reached",
          body: "Upgrade to scan another dbt project.",
          dismissLabel: "Dismiss plan limit warning",
        };

  const limitBanner = hasBlockedScans && !isLimitBannerDismissed && (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{limitBannerCopy.title}</p>
        <p className="text-xs opacity-90">{limitBannerCopy.body}</p>
      </div>
      <Button
        asChild
        size="sm"
        className="h-9 cursor-pointer bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300"
      >
        <Link href="/billing">Upgrade</Link>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setScans((prev) => prev.filter((s) => s.blockReason === null));
          setIsLimitBannerDismissed(true);
        }}
        aria-label={limitBannerCopy.dismissLabel}
        className="cursor-pointer text-amber-200 hover:bg-amber-300/10 hover:text-amber-100"
      >
        <X />
      </Button>
    </div>
  );

  const list = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
          {scans.length} {scans.length === 1 ? "file" : "files"} queued
        </p>
        {eligibleQueuedScans.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunAll}
            disabled={isLintingAll}
            className="h-9 cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            {isLintingAll ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Linting all...
              </>
            ) : (
              "Lint all"
            )}
          </Button>
        )}
      </div>
      {scans.map((item) => (
        <ScanRow
          key={item.id}
          item={item}
          onRun={() => handleRunLint(item.id)}
          onClear={() => handleClear(item.id)}
          onSubmittingResolved={(id) =>
            setScans((prev) =>
              prev.map((s) =>
                s.id === id ? { ...s, isSubmitting: false } : s,
              ),
            )
          }
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <Card
        className={cn(
          "border border-slate-800 bg-slate-900/60 text-slate-100 shadow-none ring-0",
          className,
        )}
      >
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="text-slate-100">Quick upload</CardTitle>
          <CardDescription className="text-slate-400">
            Lint dbt projects in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {dropzone}
          {limitBanner}
          {scans.length > 0 && list}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-100 sm:p-6",
        className,
      )}
    >
      {dropzone}
      {limitBanner}
      {scans.length > 0 && list}
    </div>
  );
}

// One instance of this per file, so each gets its own useRealtimeRun subscription.
function ScanRow({
  item,
  onRun,
  onClear,
  onSubmittingResolved,
}: {
  item: ScanItem;
  onRun: () => void;
  onClear: () => void;
  onSubmittingResolved: (id: string) => void;
}) {
  const router = useRouter();
  const { run, error: realtimeError } = useRealtimeRun<typeof dbtLintTask>(
    item.runId ?? undefined,
    {
      accessToken: item.accessToken ?? undefined,
      enabled: Boolean(item.runId && item.accessToken),
    },
  );
  const { refresh } = usePlanUsage();
  const [dbScan, setDbScan] = React.useState<ScanStatusResponse | null>(null);
  const requestRef = React.useRef<AbortController | null>(null);
  const settledRunIdRef = React.useRef<string | null>(null);
  const submittingResolvedRunIdRef = React.useRef<string | null>(null);
  const isRunForCurrentScan = Boolean(item.runId) && run?.id === item.runId;
  const realtimeRunStatus = isRunForCurrentScan ? run?.status : undefined;
  const realtimeMetadata = isRunForCurrentScan
    ? (run?.metadata as { Lint?: LintMetadata } | undefined)?.Lint
    : undefined;

  const fetchDbScan = React.useCallback(async () => {
    if (!item.scanId || requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await fetch(
        `/api/scans/${encodeURIComponent(item.scanId)}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Scan status request failed with ${response.status}`);
      }

      const scan = (await response.json()) as ScanStatusResponse;
      if (scan.scanId === item.scanId) setDbScan(scan);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(
          "Failed to reconcile scan status from the database",
          error,
        );
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [item.scanId]);

  React.useEffect(() => {
    void item.scanId;
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [item.scanId]);

  const currentDbScan = dbScan?.scanId === item.scanId ? dbScan : null;

  const dbRunStatus =
    currentDbScan?.status === "passed"
      ? "COMPLETED"
      : currentDbScan?.status === "failed"
        ? "FAILED"
        : currentDbScan?.status === "processing"
          ? "EXECUTING"
          : undefined;

  // A terminal DB row is authoritative. While processing, realtime remains the
  // primary, richer source because it carries live progress metadata.
  const effectiveRunStatus =
    dbRunStatus && TERMINAL_RUN_STATUSES.has(dbRunStatus)
      ? dbRunStatus
      : (realtimeRunStatus ?? dbRunStatus);
  const effectiveMetadata: LintMetadata | undefined =
    dbRunStatus && TERMINAL_RUN_STATUSES.has(dbRunStatus)
      ? {
          status: currentDbScan?.status === "passed" ? "PASSED" : "FAILED",
          statusMessage:
            currentDbScan?.status === "passed"
              ? "Lint complete"
              : "Lint failed",
          progress: 100,
          ...(currentDbScan?.report ? { report: currentDbScan.report } : {}),
        }
      : realtimeMetadata;
  const isNonTerminal = Boolean(
    item.scanId &&
      (item.isSubmitting ||
        !effectiveRunStatus ||
        !TERMINAL_RUN_STATUSES.has(effectiveRunStatus)),
  );

  // Polling is a low-frequency backstop. It is stopped as soon as either
  // realtime or the DB reports a terminal state.
  React.useEffect(() => {
    if (!isNonTerminal) return;
    const interval = window.setInterval(
      () => void fetchDbScan(),
      SCAN_STATUS_POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [fetchDbScan, isNonTerminal]);

  // Every realtime status/metadata change resets this timer. If the stream is
  // silent for 15 seconds, reconcile immediately instead of waiting forever.
  const realtimeUpdateKey = `${realtimeRunStatus ?? ""}:${JSON.stringify(realtimeMetadata ?? null)}`;
  React.useEffect(() => {
    if (!isNonTerminal) return;
    void realtimeUpdateKey;
    const timeout = window.setTimeout(
      () => void fetchDbScan(),
      SCAN_STATUS_STALL_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [fetchDbScan, isNonTerminal, realtimeUpdateKey]);

  React.useEffect(() => {
    if (!realtimeError || !isNonTerminal) return;
    console.error("Trigger.dev realtime subscription failed", realtimeError);
    void fetchDbScan();
  }, [fetchDbScan, isNonTerminal, realtimeError]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isNonTerminal) {
        void fetchDbScan();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchDbScan, isNonTerminal]);

  React.useEffect(() => {
    if (
      item.runId &&
      submittingResolvedRunIdRef.current !== item.runId &&
      effectiveRunStatus &&
      RECOGNIZED_RUN_STATUSES.has(effectiveRunStatus)
    ) {
      submittingResolvedRunIdRef.current = item.runId;
      onSubmittingResolved(item.id);
    }

    if (
      item.runId &&
      settledRunIdRef.current !== item.runId &&
      effectiveRunStatus &&
      TERMINAL_RUN_STATUSES.has(effectiveRunStatus)
    ) {
      settledRunIdRef.current = item.runId;
      router.refresh();
      void refresh().catch((error) => {
        console.error("Failed to refresh plan usage after scan settled", error);
      });
    }
  }, [
    item.id,
    item.runId,
    onSubmittingResolved,
    router,
    refresh,
    effectiveRunStatus,
  ]);

  return (
    <SelectedFile
      name={item.fileName}
      runStatus={effectiveRunStatus}
      metadata={effectiveMetadata}
      onClick={onRun}
      onClear={onClear}
      blockReason={item.blockReason}
      isSubmitting={item.isSubmitting}
    />
  );
}

function SelectedFile({
  name,
  runStatus,
  metadata,
  onClick,
  onClear,
  blockReason,
  isSubmitting,
}: {
  name: string;
  runStatus?: string;
  metadata?: LintMetadata;
  onClick: () => void;
  onClear: () => void;
  blockReason: BlockReason | null;
  isSubmitting: boolean;
}) {
  const isActivelyRunning = runStatus === "EXECUTING" || runStatus === "QUEUED";
  const isBusy = isSubmitting || isActivelyRunning;
  const isBlocked = Boolean(blockReason);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
          <FileArchive className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-xs font-medium text-slate-200">
            {name}
          </span>
          <RunStatusLine
            runStatus={runStatus}
            metadata={metadata}
            isSubmitting={isSubmitting}
          />
        </div>
        <Button
          onClick={onClick}
          size="sm"
          disabled={isBusy || isBlocked}
          className="h-9 cursor-pointer bg-emerald-400 font-semibold text-slate-950 hover:bg-emerald-300"
        >
          Run lint
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Remove file"
          className="size-9 cursor-pointer text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
        >
          <X />
        </Button>
      </div>

      {blockReason && (
        <p className="text-xs text-amber-300">
          {blockReason === "scan-limit"
            ? "Upgrade to Team to scan this project again "
            : "Upgrade required to scan another project "}
          <Link
            href="/billing"
            className="font-medium underline underline-offset-4"
          >
            Upgrade
          </Link>
        </p>
      )}

      {isActivelyRunning && <ProgressBar progress={metadata?.progress ?? 0} />}
    </div>
  );
}

function RunStatusLine({
  runStatus,
  metadata,
  isSubmitting,
}: {
  runStatus?: string;
  metadata?: LintMetadata;
  isSubmitting: boolean;
}) {
  if (isSubmitting && (!runStatus || !RECOGNIZED_RUN_STATUSES.has(runStatus))) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="size-3.5 animate-spin" />
        Starting lint run...
      </span>
    );
  }

  if (
    metadata?.statusMessage &&
    (runStatus === "EXECUTING" || runStatus === "QUEUED")
  ) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="size-3.5 animate-spin" />
        {metadata.statusMessage}
      </span>
    );
  }

  if (!runStatus) {
    return <span className="text-xs text-slate-500">Ready to lint</span>;
  }

  if (runStatus === "EXECUTING" || runStatus === "QUEUED") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="size-3.5 animate-spin" />
        Running lint...
      </span>
    );
  }

  if (runStatus === "COMPLETED") {
    const score = metadata?.report?.score;
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-emerald-300">
        <CheckCircle2 className="size-3.5" />
        {score !== undefined
          ? `Lint complete · score ${score}`
          : "Lint complete"}
      </span>
    );
  }

  if (runStatus === "FAILED" || runStatus === "CANCELED") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-rose-300">
        <XCircle className="size-3.5" />
        {metadata?.statusMessage ?? "Lint failed"}
      </span>
    );
  }

  return null;
}

function ProgressBar({ progress }: { progress: number }) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className="h-full rounded-full bg-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-slate-500">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
