"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  File,
  Lightbulb,
  Loader2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
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
};

const CATEGORY_STYLES: Record<
  FriendlyExplanation["category"],
  { badge: string; dot: string }
> = {
  "Broken query": {
    badge:
      "border border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15",
    dot: "bg-rose-400",
  },
  "Data risk": {
    badge:
      "border border-zinc-300/20 bg-zinc-300/10 text-zinc-300 hover:bg-zinc-300/15",
    dot: "bg-zinc-300",
  },
  Performance: {
    badge:
      "border border-zinc-300/20 bg-zinc-300/10 text-zinc-200 hover:bg-zinc-300/15",
    dot: "bg-zinc-300",
  },
  Readability: {
    badge:
      "border border-zinc-300/20 bg-zinc-300/10 text-zinc-300 hover:bg-zinc-300/15",
    dot: "bg-zinc-300",
  },
  Formatting: {
    badge:
      "border border-zinc-400/20 bg-zinc-400/10 text-zinc-300 hover:bg-zinc-400/15",
    dot: "bg-zinc-400",
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
      <div className="flex size-32 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 p-1">
        <div className="flex size-full items-center justify-center rounded-full bg-black">
          <Loader2 className="size-10 animate-spin text-white motion-reduce:animate-none" />
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
          className="text-zinc-900"
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
          <div className="font-mono text-2xl font-semibold text-zinc-100">
            {score}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            Score
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreTrendChart({ data }: { data: ScoreTrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
        Not enough history yet — check back after a few more runs
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
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            fontSize: 12,
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
          stroke="#34d399"
          strokeWidth={2}
          dot={{ r: 3, fill: "#34d399" }}
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-black/50 py-10 text-center">
        <File className="mb-2 size-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">
          {data.statusMessage ||
            `No ${category.toLowerCase()} found in this dbt project`}
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {data.files.map((file) => {
        const fileName = file.filePath.split("/").pop() || file.filePath;
        const isExpanded = expandedFiles.has(file.filePath);
        const friendlyViolations = explainFileViolations(file.violations);

        return (
          <div
            key={file.filePath}
            className="overflow-hidden rounded-xl border border-zinc-900 bg-black/55"
          >
            <button
              type="button"
              className="group w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              onClick={() => toggleFile(file.filePath)}
            >
              <div className="scrollbar-hide flex min-h-11 w-full items-center gap-3 overflow-x-auto bg-black/70 p-3 transition-colors duration-200 hover:bg-zinc-900/70">
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="size-4 text-zinc-500" />
                </motion.span>
                <File className="size-4 flex-shrink-0 text-white" />
                <div className="flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="whitespace-nowrap font-mono text-xs font-medium text-zinc-200">
                      {fileName}
                    </p>
                    {file.errors > 0 && (
                      <Badge
                        variant="destructive"
                        className="whitespace-nowrap border border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
                      >
                        {file.errors} error{file.errors !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {file.warnings > 0 && (
                      <Badge className="whitespace-nowrap border border-zinc-300/20 bg-zinc-300/10 text-zinc-200 hover:bg-zinc-300/15">
                        {file.warnings} warning{file.warnings !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-mono text-[10px] text-zinc-500">
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
                  <div className="space-y-2 border-l border-zinc-900 p-3 pl-6">
                    {friendlyViolations.length === 0 ? (
                      <p className="text-sm text-zinc-500">
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
                            className="rounded-lg border border-zinc-900 bg-zinc-950/60 p-3"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-zinc-300" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-zinc-100">
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
                                <p className="mt-1 break-words text-sm leading-6 text-zinc-400">
                                  {violation.explanation}
                                </p>
                                {(violation.lineNo !== undefined ||
                                  violation.linePos !== undefined) && (
                                  <p className="mt-2 font-mono text-xs text-zinc-500">
                                    Line {violation.lineNo ?? "?"}:
                                    {violation.linePos ?? "?"}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleViolationDetails(key)}
                                  className="min-h-9 cursor-pointer rounded-md text-xs text-white hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                  {showTechnicalDetails ? "Hide" : "Show"}{" "}
                                  technical details
                                </button>
                                {showTechnicalDetails && (
                                  <div className="mt-2 space-y-1 rounded-lg border border-zinc-900 bg-black p-3">
                                    {violation.rawCode && (
                                      <p className="font-mono text-xs text-white">
                                        {violation.rawCode}
                                      </p>
                                    )}
                                    {violation.rawDescription && (
                                      <p className="break-words font-mono text-xs text-zinc-500">
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
    <div className="overflow-hidden rounded-xl border border-zinc-900 bg-black/55">
      <button
        type="button"
        className="group w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex min-h-11 w-full items-center gap-3 bg-black/70 p-3 transition-colors duration-200 hover:bg-zinc-900/70">
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ChevronDown className="size-4 text-zinc-500" />
          </motion.span>
          <span
            className={`inline-block size-2 flex-shrink-0 rounded-full ${CATEGORY_STYLES[group.category].dot}`}
          />
          <span className="flex-1 text-left text-sm font-medium text-zinc-100">
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
            <div className="border-l border-zinc-900 p-3 pl-6">
              <ul className="space-y-4 py-2">
                {group.items.map((rec) => (
                  <li
                    key={`${rec.category}-${rec.title}`}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span
                      className={`mt-1.5 inline-block size-1.5 flex-shrink-0 rounded-full ${CATEGORY_STYLES[rec.category].dot}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-100">
                          {rec.title}
                        </span>
                        {rec.occurrences > 1 && (
                          <span className="text-xs text-zinc-500">
                            {rec.occurrences} occurrences
                          </span>
                        )}
                      </div>
                      <p className="break-words text-zinc-400">
                        {rec.explanation}
                      </p>
                      <p className="break-words text-xs text-zinc-500">
                        {rec.impact}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getStatusIcon(status: "passed" | "failed" | "processing"): string {
  if (status === "passed") return "✓";
  if (status === "failed") return "✗";
  return "▸";
}

export function ProjectDetailPanel({ data }: ProjectDetailPanelProps) {
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
      color: "border border-white/20 bg-white/10 text-zinc-100",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      color: "border border-rose-400/20 bg-rose-400/10 text-rose-300",
    },
    processing: {
      icon: Loader2,
      label: "Processing",
      color: "border border-zinc-300/20 bg-zinc-300/10 text-zinc-200",
    },
  };

  const status = statusConfig[data.status];
  const StatusIcon = status.icon;

  return (
    <div className="relative isolate space-y-6 font-sans text-zinc-100 before:fixed before:inset-0 before:-z-10 before:bg-black">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950/70">
        <div className="flex h-11 items-center gap-2 border-b border-zinc-900 bg-black/70 px-4">
          <span className="size-2.5 rounded-full bg-rose-400/80" />
          <span className="size-2.5 rounded-full bg-zinc-300/80" />
          <span className="size-2.5 rounded-full bg-white/80" />
          <span className="ml-2 font-mono text-[10px] text-zinc-500">
            dbtlint · project report
          </span>
        </div>
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white">
              Latest lint run
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
              {data.project}
            </h2>
            <p className="mt-2 font-mono text-[11px] text-zinc-500">
              {data.report?.totals.files || 0} files linted ·{" "}
              {data.report?.totals.lines} lines scanned · {relativeTime}
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${status.color}`}
          >
            <span
              className={`[&_svg]:size-3.5 ${data.status === "processing" ? "animate-spin motion-reduce:animate-none" : ""}`}
            >
              <StatusIcon />
            </span>
            {status.label}
          </span>
        </div>
      </div>

      {/* Score and Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-950/60 p-6 lg:col-span-1">
          <ScoreGauge score={data.score} status={data.status} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-zinc-900 bg-zinc-950/60 p-4 shadow-none ring-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Errors
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums text-rose-300">
                  {data.errors}
                </span>
              </div>
            </Card>
            <Card className="border border-zinc-900 bg-zinc-950/60 p-4 shadow-none ring-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Warnings
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-200">
                  {data.warnings}
                </span>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-zinc-900 bg-black/55 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Files linted
              </p>
              <p className="mt-1 font-mono font-semibold tabular-nums text-zinc-100">
                {data.report?.totals.files || 0}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-900 bg-black/55 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Lines scanned
              </p>
              <p className="mt-1 font-mono font-semibold tabular-nums text-zinc-100">
                {data.report?.totals.lines || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Score Trend */}
      {data.scoreHistory && data.scoreHistory.length > 0 && (
        <Card className="border border-zinc-900 bg-zinc-950/60 p-5 shadow-none ring-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Score trend (weekly)
            </span>
            {data.scoreHistory.length >= 2 && (
              <span
                className={`text-xs font-medium ${
                  data.scoreHistory[data.scoreHistory.length - 1].score >=
                  data.scoreHistory[0].score
                    ? "text-zinc-100"
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
          <ScoreTrendChart data={data.scoreHistory} />
        </Card>
      )}

      {/* Tabs Section */}
      {data.report && (
        <Card className="overflow-x-hidden border border-zinc-900 bg-zinc-950/60 p-0 shadow-none ring-0">
          <Tabs defaultValue="models" className="w-full">
            <TabsList className="h-auto w-full justify-start gap-2 rounded-none border-b border-zinc-900 bg-black/55 p-2">
              <TabsTrigger
                value="models"
                className="min-h-10 cursor-pointer rounded-lg border border-transparent px-4 py-2 font-sans text-sm text-zinc-400 data-[state=active]:border-white/20 data-[state=active]:bg-white/10 data-[state=active]:text-zinc-100"
              >
                Models
              </TabsTrigger>
              <TabsTrigger
                value="tests"
                className="min-h-10 cursor-pointer rounded-lg border border-transparent px-4 py-2 font-sans text-sm text-zinc-400 data-[state=active]:border-white/20 data-[state=active]:bg-white/10 data-[state=active]:text-zinc-100"
              >
                Tests
              </TabsTrigger>
              <TabsTrigger
                value="macros"
                className="min-h-10 cursor-pointer rounded-lg border border-transparent px-4 py-2 font-sans text-sm text-zinc-400 data-[state=active]:border-white/20 data-[state=active]:bg-white/10 data-[state=active]:text-zinc-100"
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
      <Card className="border border-zinc-900 bg-zinc-950/60 p-5 shadow-none ring-0 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="size-5 text-zinc-300" />
          <h3 className="font-semibold text-zinc-100">Recommendations</h3>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-sm leading-6 text-zinc-400">
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
