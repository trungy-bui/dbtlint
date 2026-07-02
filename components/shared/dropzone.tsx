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
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deriveProjectName,
  FREE_PLAN_PROJECT_LIMIT,
  type Plan,
} from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { LintMetadata } from "@/lib/validation/lint";
import type { dbtLintTask } from "@/trigger/dbtLintTask";

const PLAN_LIMIT_REACHED_CODE = "PLAN_LIMIT_REACHED";

type BlockReason = "plan-limit";

type UploadZoneProps = {
  className?: string;
  compact?: boolean;
  plan?: Plan;
  existingProjects?: string[];
};

type ScanItem = {
  id: string;
  file: File;
  fileName: string;
  scanId: string | null;
  accessToken: string | null;
  projectName: string;
  blockReason: BlockReason | null;
};

export function UploadZone({
  className,
  compact = false,
  plan = "free",
  existingProjects = [],
}: UploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [scans, setScans] = React.useState<ScanItem[]>([]);
  const [isLimitBannerDismissed, setIsLimitBannerDismissed] =
    React.useState(false);
  const existingProjectSet = React.useMemo(
    () => new Set(existingProjects),
    [existingProjects],
  );
  const hasPlanLimitBlockedScans = scans.some(
    (scan) => scan.blockReason === "plan-limit",
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const queuedProjectNames = new Set(scans.map((scan) => scan.projectName));
    const queuedNewProjectNames = new Set(
      scans
        .filter(
          (scan) =>
            scan.blockReason !== "plan-limit" &&
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
        const wouldExceedFreeLimit =
          plan === "free" &&
          isNewProject &&
          existingProjects.length + queuedNewProjectNames.size >=
            FREE_PLAN_PROJECT_LIMIT;
        const blockReason: BlockReason | null = wouldExceedFreeLimit
          ? "plan-limit"
          : null;

        if (!wouldExceedFreeLimit && isNewProject) {
          queuedNewProjectNames.add(projectName);
        }

        return [
          {
            id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2)}`,
            file: f,
            fileName: f.name,
            scanId: null,
            accessToken: null,
            projectName,
            blockReason,
          },
        ];
      });

    if (newItems.some((item) => item.blockReason === "plan-limit")) {
      setIsLimitBannerDismissed(false);
    }

    setScans((prev) => [...prev, ...newItems]);
  };

  const handleRunLint = async (id: string) => {
    const item = scans.find((s) => s.id === id);
    if (!item || item.blockReason) return;

    try {
      const supabase = createClient();
      const filePath = `uploads/${Date.now()}-${item.file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dbt-uploads")
        .upload(filePath, item.file);

      if (uploadError || !uploadData) {
        console.error("Upload failed:", uploadError);
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

      if (response.status === 403 && data?.code === PLAN_LIMIT_REACHED_CODE) {
        setIsLimitBannerDismissed(false);
        setScans((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, blockReason: "plan-limit" } : s,
          ),
        );
        return;
      }

      if (!response.ok) {
        console.error("Lint request failed:", data);
        return;
      }

      setScans((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, scanId: data.runId, accessToken: data.publicAccessToken }
            : s,
        ),
      );
    } catch (error) {
      console.log(error);
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
        "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/20 text-center outline-none transition-colors",
        "hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50",
        isDragging && "border-primary bg-primary/10",
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
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <UploadCloud className="size-6" />
      </motion.div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Drop your dbt ZIP files here or{" "}
          <span className="text-primary">click to browse</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Supports .zip archives up to 50MB, multiple files allowed
        </p>
      </div>
    </Button>
  );

  const limitBanner = hasPlanLimitBlockedScans && !isLimitBannerDismissed && (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Free plan project limit reached</p>
        <p className="text-xs opacity-90">
          Upgrade to scan another dbt project.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/billing">Upgrade</Link>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setIsLimitBannerDismissed(true)}
        aria-label="Dismiss plan limit warning"
      >
        <X />
      </Button>
    </div>
  );

  const list = (
    <div className="flex flex-col gap-2">
      {scans.map((item) => (
        <ScanRow
          key={item.id}
          item={item}
          onRun={() => handleRunLint(item.id)}
          onClear={() => handleClear(item.id)}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Quick Upload</CardTitle>
          <CardDescription>Lint dbt projects in seconds.</CardDescription>
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
    <div className={cn("flex flex-col gap-3", className)}>
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
}: {
  item: ScanItem;
  onRun: () => void;
  onClear: () => void;
}) {
  const { run } = useRealtimeRun<typeof dbtLintTask>(item.scanId ?? undefined, {
    accessToken: item.accessToken ?? undefined,
    enabled: Boolean(item.scanId && item.accessToken),
  });

  const metadata = (run?.metadata as { Lint?: LintMetadata } | undefined)?.Lint;

  return (
    <SelectedFile
      name={item.fileName}
      runStatus={run?.status}
      metadata={metadata}
      onClick={onRun}
      onClear={onClear}
      blockReason={item.blockReason}
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
}: {
  name: string;
  runStatus?: string;
  metadata?: LintMetadata;
  onClick: () => void;
  onClear: () => void;
  blockReason: BlockReason | null;
}) {
  const isRunning = runStatus === "EXECUTING" || runStatus === "QUEUED";
  const isBlocked = Boolean(blockReason);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileArchive className="size-10" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          <RunStatusLine runStatus={runStatus} metadata={metadata} />
        </div>
        <Button onClick={onClick} size="sm" disabled={isRunning || isBlocked}>
          Run lint
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label="Remove file"
        >
          <X />
        </Button>
      </div>

      {blockReason === "plan-limit" && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Upgrade required to scan another project{" "}
          <Link
            href="/billing"
            className="font-medium underline underline-offset-4"
          >
            Upgrade
          </Link>
        </p>
      )}

      {isRunning && <ProgressBar progress={metadata?.progress ?? 0} />}
    </div>
  );
}

function RunStatusLine({
  runStatus,
  metadata,
}: {
  runStatus?: string;
  metadata?: LintMetadata;
}) {
  if (
    metadata?.statusMessage &&
    (runStatus === "EXECUTING" || runStatus === "QUEUED")
  ) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {metadata.statusMessage}
      </span>
    );
  }

  if (!runStatus) {
    return <span className="text-xs text-muted-foreground">Ready to lint</span>;
  }

  if (runStatus === "EXECUTING" || runStatus === "QUEUED") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Running lint...
      </span>
    );
  }

  if (runStatus === "COMPLETED") {
    const score = metadata?.report?.score;
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="size-3.5" />
        {score !== undefined
          ? `Lint complete · score ${score}`
          : "Lint complete"}
      </span>
    );
  }

  if (runStatus === "FAILED" || runStatus === "CANCELED") {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
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
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
