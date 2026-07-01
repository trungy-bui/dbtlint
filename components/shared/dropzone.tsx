"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  FileArchive,
  Loader2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { dbtLintTask } from "@/trigger/dbtLintTask";
import { createClient } from "@/lib/supabase/client";
import { LintMetadata } from "@/lib/validation/lint";

type UploadZoneProps = {
  className?: string;
  compact?: boolean;
};

export function UploadZone({ className, compact = false }: UploadZoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [scanId, setScanId] = React.useState<string | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const { run, error } = useRealtimeRun<typeof dbtLintTask>(
    scanId ?? undefined,
    {
      accessToken: accessToken ?? undefined,
      enabled: Boolean(!!scanId && !!accessToken),
    },
  );

  const metadata = (run?.metadata as { Lint?: LintMetadata } | undefined)?.Lint;

  const handleFiles = (files: FileList | null) => {
    const selectedFile = files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setScanId(null);
      setAccessToken(null);
    }
  };

  const handleRunLint = async () => {
    try {
      if (!file) return;
      const supabase = createClient();

      const filePath = `uploads/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dbt-uploads")
        .upload(filePath, file);

      if (uploadError || !uploadData) {
        console.error("Upload failed:", uploadError);
        return;
      }

      const response = await fetch("/api/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          filePath: uploadData.path,
        }),
      });

      const data = await response.json();
      setScanId(data.runId);
      setAccessToken(data.publicAccessToken);
    } catch (error) {
      console.log(error);
    }
  };

  const handleClear = () => {
    setFile(null);
    setFileName(null);
    setScanId(null);
    setAccessToken(null);
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
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 text-center outline-none transition-colors",
        "hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50 h-15",
        isDragging && "border-primary bg-primary/10",
        compact ? "px-6 py-40" : "px-6 py-20",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
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
          Drop your dbt ZIP file here or{" "}
          <span className="text-primary">click to browse</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Supports .zip archives up to 50MB
        </p>
      </div>
    </Button>
  );

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Quick Upload</CardTitle>
          <CardDescription>Lint a new dbt project in seconds.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {dropzone}
          {fileName && (
            <SelectedFile
              name={fileName}
              runStatus={run?.status}
              metadata={metadata}
              onClick={handleRunLint}
              onClear={handleClear}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {dropzone}
      {fileName && (
        <SelectedFile
          name={fileName}
          runStatus={run?.status}
          metadata={metadata}
          onClick={handleRunLint}
          onClear={handleClear}
        />
      )}
    </div>
  );
}

function SelectedFile({
  name,
  runStatus,
  metadata,
  onClick,
  onClear,
}: {
  name: string;
  runStatus?: string;
  metadata?: LintMetadata;
  onClick: () => void;
  onClear: () => void;
}) {
  const isRunning = runStatus === "EXECUTING" || runStatus === "QUEUED";

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
        <Button onClick={onClick} size="sm" disabled={isRunning}>
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
  // Prefer live metadata status text once the task starts reporting it.
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
