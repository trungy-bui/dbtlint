"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  File,
  Lightbulb,
  Loader2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LintReportJson } from "@/db/schema";
import { useScanStatusPolling } from "@/hooks/use-scan-status-polling";
import {
  buildRecommendations,
  explainFileViolations,
  groupRecommendationsByCategory,
  type RecommendationGroup,
} from "@/lib/reports/report-recommendations";
import type { FriendlyExplanation } from "@/lib/reports/rule-explanations";

type LintCategoryReport =
  LintReportJson["categories"][keyof LintReportJson["categories"]];

export type ScoreTrendPoint = {
  date: string; // ISO date string
  score: number;
};

export type ProjectDetail = {
  project: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  createdAt: string;
  report?: LintReportJson;
  scoreHistory?: ScoreTrendPoint[];
};

type ProjectDetailPanelProps = {
  data: ProjectDetail;
  scanId: string;
};

const CATEGORY_STYLES: Record<
  FriendlyExplanation["category"],
  { badge: string; dot: string }
> = {
  "Broken query": {
    badge: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
    dot: "bg-red-500",
  },
  "Data risk": {
    badge: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30",
    dot: "bg-orange-500",
  },
  Performance: {
    badge: "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
    dot: "bg-amber-500",
  },
  Readability: {
    badge: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
    dot: "bg-blue-500",
  },
  Formatting: {
    badge: "bg-slate-500/20 text-slate-400 hover:bg-slate-500/30",
    dot: "bg-slate-500",
  },
};

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const past = new Date(isoDate);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return past.toLocaleDateString();
}

function escapeCSVValue(value: string | number | undefined): string {
  const stringValue = value?.toString() ?? "";

  if (/[,"\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function downloadReportCSV(data: ProjectDetail): void {
  if (!data.report) return;

  const rows: Array<Array<string | number | undefined>> = [
    [
      "Category",
      "File",
      "Line",
      "Column",
      "Violation Category",
      "Title",
      "Explanation",
      "Source line",
      "Technical rule code",
    ],
  ];

  for (const [category, sectionData] of Object.entries(
    data.report.categories,
  )) {
    if (sectionData.skipped) continue;

    for (const file of sectionData.files) {
      const violations = explainFileViolations(file.violations);

      for (const violation of violations) {
        rows.push([
          category,
          file.filePath,
          violation.lineNo,
          violation.linePos,
          violation.category,
          violation.title,
          violation.explanation,
          violation.sourceLine,
          violation.rawCode,
        ]);
      }
    }
  }

  const csv = `\uFEFF${rows
    .map((row) => row.map(escapeCSVValue).join(","))
    .join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${data.project.toLowerCase().replace(/\s+/g, "-")}-lint-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SourceLineBlock({
  lineNo,
  sourceLine,
}: {
  lineNo?: number;
  sourceLine: string;
}) {
  return (
    <pre className="mt-2 overflow-x-auto rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs leading-relaxed">
      <code className="grid min-w-max grid-cols-[auto_1fr]">
        <span className="select-none border-r border-slate-800 pr-3 text-right text-slate-500">
          {lineNo ?? "?"}
        </span>
        <span className="pl-3 text-slate-300">{sourceLine || " "}</span>
      </code>
    </pre>
  );
}

function ScoreGauge({ score, status }: { score: number; status: string }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  let strokeColor = "#4FBF9F";
  if (score < 70) strokeColor = "#E3A63E";
  if (score < 50) strokeColor = "#D65C4B";
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (status === "processing") {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 p-1">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
          <Loader2 className="size-12 animate-spin text-emerald-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-32 w-32">
      <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-panel-raised"
        />
        <motion.circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={prefersReducedMotion ? 0 : offset}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.5, ease: "easeOut" }
          }
          className="transform -rotate-90 origin-center"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{score}</div>
          <div className="text-xs text-muted-foreground">Score</div>
        </div>
      </div>
    </div>
  );
}

function ScoreTrendChart({ data }: { data: ScoreTrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="relative flex min-h-48 overflow-hidden rounded-xl border border-dashed border-surface-border bg-surface-nested px-6 py-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(100,116,139,0.13)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.13)_1px,transparent_1px)] [background-size:40px_32px]"
        />
        <div
          aria-hidden="true"
          className="absolute right-8 bottom-8 left-8 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent"
        />
        <div className="relative z-10 m-auto flex max-w-md flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.08)]">
            <TrendingUp aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-100">
            Your score trend starts here
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Run this project again to compare quality scores and reveal the
            direction of change over time.
          </p>
          <span className="terminal-label mt-4 rounded-full border border-surface-border bg-slate-950/70 px-3 py-1.5 text-slate-300">
            {data.length === 1 ? "1 run recorded" : "No history recorded"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={(d) =>
            new Date(d).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })
          }
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #475569",
            borderRadius: 12,
            fontSize: 12,
            color: "#f8fafc",
            boxShadow: "0 16px 40px rgba(2, 6, 23, 0.42)",
          }}
          labelFormatter={(d) =>
            new Date(d).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          }
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#4FBF9F"
          strokeWidth={2}
          dot={{ r: 3, fill: "#4FBF9F" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategorySection({
  category,
  data,
}: {
  category: string;
  data: LintCategoryReport;
}) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(
    new Set(),
  );

  const toggleFile = (filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

  const toggleViolationDetails = (key: string) => {
    setExpandedViolations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (data.skipped) {
    return (
      <div className="surface-nested flex flex-col items-center justify-center border-dashed py-10 text-center">
        <File className="mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {data.statusMessage ||
            `No ${category.toLowerCase()} found in this dbt project`}
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-2 [scrollbar-color:#1e293b_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-track]:bg-transparent">
      {data.files.map((file) => {
        const fileName = file.filePath.split("/").pop() || file.filePath;
        const isExpanded = expandedFiles.has(file.filePath);
        const friendlyViolations = explainFileViolations(file.violations);

        return (
          <div
            key={file.filePath}
            className="overflow-hidden rounded-xl border border-surface-border bg-surface-nested"
          >
            <button
              type="button"
              className="group w-full cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70"
              onClick={() => toggleFile(file.filePath)}
            >
              <div className="flex w-full min-w-0 items-center gap-2 bg-surface-nested p-3 transition-colors duration-200 hover:bg-slate-800 motion-reduce:transition-none">
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="size-4 text-muted-foreground" />
                </motion.span>
                <File className="size-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 max-w-full truncate text-sm font-medium text-foreground">
                      {fileName}
                    </p>
                    {file.errors > 0 && (
                      <Badge
                        variant="destructive"
                        className="whitespace-nowrap bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        {file.errors} error{file.errors !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {file.warnings > 0 && (
                      <Badge className="whitespace-nowrap bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                        {file.warnings} warning{file.warnings !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {file.filePath}
                  </p>
                </div>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 border-t border-surface-border bg-slate-950/35 p-3">
                    {friendlyViolations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No violations found
                      </p>
                    ) : (
                      friendlyViolations.map((violation, index) => {
                        const key = `${file.filePath}-${index}-${violation.rawCode ?? "violation"}`;
                        const showTechnicalDetails =
                          expandedViolations.has(key);

                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-surface-border bg-surface-card p-3"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-500" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">
                                    {violation.title}
                                  </p>
                                  <Badge
                                    className={
                                      CATEGORY_STYLES[violation.category].badge
                                    }
                                  >
                                    {violation.category}
                                  </Badge>
                                </div>
                                <p className="mt-1 break-words text-sm text-muted-foreground">
                                  {violation.explanation}
                                </p>
                                {violation.sourceLine === undefined &&
                                  violation.lineNo !== undefined && (
                                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                                      Line {violation.lineNo}
                                    </p>
                                  )}
                                {violation.sourceLine !== undefined && (
                                  <SourceLineBlock
                                    lineNo={violation.lineNo}
                                    sourceLine={violation.sourceLine}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleViolationDetails(key)}
                                  className="mt-2 cursor-pointer rounded-sm text-xs text-emerald-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                                >
                                  {showTechnicalDetails ? "Hide" : "Show"}{" "}
                                  technical details
                                </button>
                                {showTechnicalDetails && (
                                  <div className="mt-2 space-y-1 rounded border border-slate-800 bg-slate-950 p-2">
                                    {violation.rawCode && (
                                      <p className="font-mono text-xs text-emerald-400">
                                        {violation.rawCode}
                                      </p>
                                    )}
                                    {violation.rawDescription && (
                                      <p className="break-words font-mono text-xs text-muted-foreground">
                                        {violation.rawDescription}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationGroupSection({
  group,
  defaultOpen,
}: {
  group: RecommendationGroup;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-nested">
      <button
        type="button"
        className="group w-full cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70"
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex w-full items-center gap-3 bg-surface-nested p-3 transition-colors duration-200 hover:bg-slate-800 motion-reduce:transition-none">
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ChevronDown className="size-4 text-muted-foreground" />
          </motion.span>
          <span
            className={`inline-block size-2 flex-shrink-0 rounded-full ${CATEGORY_STYLES[group.category].dot}`}
          />
          <span className="flex-1 text-left text-sm font-medium text-foreground">
            {group.category} ({group.items.length})
          </span>
          <Badge className={CATEGORY_STYLES[group.category].badge}>
            {group.totalOccurrences}
          </Badge>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-border bg-slate-950/35 px-4 py-2">
              <ul className="space-y-4 py-2">
                {group.items.map((rec) => {
                  const [onlyOccurrence] = rec.occurrences;
                  const displayedOccurrences = rec.occurrences.slice(0, 3);

                  return (
                    <li
                      key={`${rec.category}-${rec.title}`}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span
                        className={`mt-1.5 inline-block size-1.5 flex-shrink-0 rounded-full ${CATEGORY_STYLES[rec.category].dot}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {rec.title}
                          </span>
                          {rec.occurrences.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                              {rec.occurrences.length} occurrences
                            </span>
                          )}
                        </div>
                        <p className="break-words text-muted-foreground">
                          {rec.explanation}
                        </p>
                        <p className="break-words text-xs text-muted-foreground/80">
                          {rec.impact}
                        </p>
                        {rec.occurrences.length === 1 && onlyOccurrence && (
                          <div className="pt-1">
                            <p className="break-all font-mono text-xs text-muted-foreground">
                              {onlyOccurrence.filePath}
                            </p>
                            {onlyOccurrence.sourceLine === undefined &&
                              onlyOccurrence.lineNo !== undefined && (
                                <p className="mt-1 font-mono text-xs text-muted-foreground">
                                  Line {onlyOccurrence.lineNo}
                                </p>
                              )}
                            {onlyOccurrence.sourceLine !== undefined && (
                              <SourceLineBlock
                                lineNo={onlyOccurrence.lineNo}
                                sourceLine={onlyOccurrence.sourceLine}
                              />
                            )}
                          </div>
                        )}
                        {rec.occurrences.length > 1 && (
                          <div className="space-y-1 pt-1 font-mono text-xs text-muted-foreground">
                            {displayedOccurrences.map((occurrence, index) => (
                              <p
                                key={`${occurrence.filePath}-${occurrence.lineNo ?? "unknown"}-${occurrence.linePos ?? "unknown"}-${index}`}
                                className="break-all"
                              >
                                {occurrence.filePath}
                                {occurrence.lineNo !== undefined && (
                                  <>, line {occurrence.lineNo}</>
                                )}
                              </p>
                            ))}
                            {rec.occurrences.length >
                              displayedOccurrences.length && (
                              <p className="text-muted-foreground/80">
                                +
                                {rec.occurrences.length -
                                  displayedOccurrences.length}{" "}
                                more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProjectDetailPanel({
  data: initialData,
  scanId,
}: ProjectDetailPanelProps) {
  const [currentData, setCurrentData] = useState(initialData);
  const scanStatuses = useScanStatusPolling(
    currentData.status === "processing" ? [scanId] : [],
  );
  const currentScan = scanStatuses[scanId];

  useEffect(() => {
    setCurrentData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!currentScan) return;

    setCurrentData((current) => ({
      ...current,
      status: currentScan.status,
      score: currentScan.score,
      errors: currentScan.errors,
      warnings: currentScan.warnings,
      ...(currentScan.report ? { report: currentScan.report } : {}),
    }));
  }, [currentScan]);

  const data = currentData;
  const recommendations = useMemo(
    () => (data.report ? buildRecommendations(data.report) : []),
    [data.report],
  );
  const recommendationGroups = useMemo(
    () => groupRecommendationsByCategory(recommendations),
    [recommendations],
  );
  const relativeTime = getRelativeTime(data.createdAt);

  const statusConfig = {
    passed: {
      icon: CheckCircle2,
      label: "Passed",
      color: "bg-emerald-500/20 text-emerald-400",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      color: "bg-red-500/20 text-red-400",
    },
    processing: {
      icon: Loader2,
      label: "Processing",
      color: "bg-amber-500/20 text-amber-400",
    },
  };

  const status = statusConfig[data.status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-8 font-sans text-ink">
      {/* Header */}
      <div className="surface-card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="terminal-label text-emerald-400">Scan results</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
              {data.project}
            </h1>
            <Badge className={status.color}>
              <StatusIcon
                aria-hidden="true"
                className={
                  data.status === "processing"
                    ? "animate-spin motion-reduce:animate-none"
                    : undefined
                }
              />
              {status.label}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {data.report?.totals.files || 0} files linted ·{" "}
            {data.report?.totals.lines || 0} lines scanned · {relativeTime}
          </p>
        </div>
        {data.report && (
          <button
            type="button"
            onClick={() => downloadReportCSV(data)}
            className="interactive-surface inline-flex h-10 flex-shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-nested px-4 text-sm font-medium text-slate-100"
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </button>
        )}
      </div>

      {/* Score and Stats */}
      <section
        aria-label="Scan score summary"
        className="surface-card grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-3"
      >
        <div className="surface-nested flex min-h-48 items-center justify-center p-6 md:col-span-1">
          <ScoreGauge score={data.score} status={data.status} />
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-surface-border bg-surface-nested p-4 shadow-none">
              <div className="terminal-label">Errors</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-rose-300">
                  {data.errors}
                </span>
              </div>
            </Card>
            <Card className="border-surface-border bg-surface-nested p-4 shadow-none">
              <div className="terminal-label">Warnings</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-amber-300">
                  {data.warnings}
                </span>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="surface-nested px-4 py-3">
              <p className="terminal-label">Files linted</p>
              <p className="mt-1 font-mono font-semibold text-slate-100">
                {data.report?.totals.files || 0}
              </p>
            </div>
            <div className="surface-nested px-4 py-3">
              <p className="terminal-label">Lines scanned</p>
              <p className="mt-1 font-mono font-semibold text-slate-100">
                {data.report?.totals.lines || 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Score Trend */}
      <Card className="border-surface-border bg-surface-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="terminal-label text-emerald-400">Quality history</p>
            <h2 className="mt-1 text-base font-semibold text-slate-100">
              Score trend
            </h2>
          </div>
          {data.scoreHistory && data.scoreHistory.length >= 2 && (
            <span
              className={`text-xs font-medium ${
                data.scoreHistory[data.scoreHistory.length - 1].score >=
                data.scoreHistory[0].score
                  ? "text-emerald-400"
                  : "text-rose-300"
              }`}
            >
              {data.scoreHistory[data.scoreHistory.length - 1].score -
                data.scoreHistory[0].score >=
              0
                ? "+"
                : ""}
              {data.scoreHistory[data.scoreHistory.length - 1].score -
                data.scoreHistory[0].score}{" "}
              over period
            </span>
          )}
        </div>
        <ScoreTrendChart data={data.scoreHistory ?? []} />
      </Card>

      {/* Tabs Section */}
      {data.report && (
        <Card className="overflow-x-hidden border-surface-border bg-surface-card p-0">
          <Tabs defaultValue="models" className="w-full">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-surface-border bg-surface-nested p-0">
              <TabsTrigger
                value="models"
                className="px-0 py-3 font-sans text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-code-accent data-[state=active]:bg-transparent"
              >
                Models
              </TabsTrigger>
              <TabsTrigger
                value="tests"
                className="px-0 py-3 font-sans text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-code-accent data-[state=active]:bg-transparent"
              >
                Tests
              </TabsTrigger>
              <TabsTrigger
                value="macros"
                className="px-0 py-3 font-sans text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-code-accent data-[state=active]:bg-transparent"
              >
                Macros
              </TabsTrigger>
            </TabsList>
            <div className="p-4">
              <TabsContent value="models" className="mt-0">
                <CategorySection
                  category="Models"
                  data={data.report.categories.models}
                />
              </TabsContent>
              <TabsContent value="tests" className="m-0">
                <CategorySection
                  category="Tests"
                  data={data.report.categories.tests}
                />
              </TabsContent>
              <TabsContent value="macros" className="m-0">
                <CategorySection
                  category="Macros"
                  data={data.report.categories.macros}
                />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="border-surface-border bg-surface-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" />
          <h3 className="font-semibold text-foreground">Recommendations</h3>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Continue following dbt best practices for optimal project health.
          </p>
        ) : (
          <div className="space-y-2">
            {recommendationGroups.map((group, index) => (
              <RecommendationGroupSection
                key={group.category}
                group={group}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
