"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
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
  focus?: ReportFocus;
};

export type ReportFocus = "errors" | "warnings";

type ReportCategory = keyof LintReportJson["categories"];

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
      "Rule",
      "Title",
      "Explanation",
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
          violation.rawCode,
          violation.title,
          violation.explanation,
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

function getScoreColor(
  score: number,
):
  | "from-emerald-500 to-emerald-600"
  | "from-amber-500 to-amber-600"
  | "from-red-500 to-red-600" {
  if (score >= 90) return "from-emerald-500 to-emerald-600";
  if (score >= 70) return "from-amber-500 to-amber-600";
  return "from-red-500 to-red-600";
}

function ScoreGauge({ score, status }: { score: number; status: string }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colorClass = getScoreColor(score);
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
        <text
          x="60"
          y="60"
          textAnchor="middle"
          dy="0.3em"
          className="fill-ink font-mono text-2xl font-bold"
        >
          {score}
        </text>
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
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
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
            background: "#18181b",
            border: "1px solid #27272a",
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
  focus,
}: {
  category: string;
  data: LintCategoryReport;
  focus?: ReportFocus;
}) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    () =>
      new Set(
        focus
          ? data.files
              .filter((file) => file[focus] > 0)
              .map((file) => file.filePath)
          : [],
      ),
  );
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 py-8 text-center">
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
        const isFocused = focus !== undefined && file[focus] > 0;
        const friendlyViolations = explainFileViolations(file.violations);

        return (
          <div
            key={file.filePath}
            className={`overflow-hidden rounded-md border bg-slate-900 ${
              isFocused
                ? focus === "errors"
                  ? "border-red-400/60 ring-1 ring-red-400/20"
                  : "border-amber-400/60 ring-1 ring-amber-400/20"
                : "border-slate-800"
            }`}
          >
            <button
              type="button"
              className="group w-full"
              onClick={() => toggleFile(file.filePath)}
            >
              <div className="flex w-full min-w-0 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 p-2.5 hover:bg-slate-800">
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
                  <div className="mt-2 space-y-2 pl-6 border-l border-slate-800">
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
                            className="rounded-md border border-slate-800 bg-slate-900/50 p-3"
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
                                {(violation.lineNo !== undefined ||
                                  violation.linePos !== undefined) && (
                                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                                    Line {violation.lineNo ?? "?"}:
                                    {violation.linePos ?? "?"}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleViolationDetails(key)}
                                  className="mt-2 text-xs text-emerald-400 hover:underline"
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
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
      <button
        type="button"
        className="group w-full"
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex w-full items-center gap-3 rounded-md border border-slate-800 bg-slate-900 p-3 hover:bg-slate-800">
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
            <div className="mt-2 border-l border-slate-800 pl-6">
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
                        <span className="font-medium text-foreground">
                          {rec.title}
                        </span>
                        {rec.occurrences > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {rec.occurrences} occurrences
                          </span>
                        )}
                      </div>
                      <p className="break-words text-muted-foreground">
                        {rec.explanation}
                      </p>
                      <p className="break-words text-xs text-muted-foreground/80">
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

export function ProjectDetailPanel({ data, focus }: ProjectDetailPanelProps) {
  const recommendations = useMemo(
    () => (data.report ? buildRecommendations(data.report) : []),
    [data.report],
  );
  const recommendationGroups = useMemo(
    () => groupRecommendationsByCategory(recommendations),
    [recommendations],
  );
  const relativeTime = getRelativeTime(data.createdAt);
  const focusedCategory: ReportCategory = useMemo(() => {
    if (!data.report || !focus) return "models";

    const categories: ReportCategory[] = ["models", "tests", "macros"];
    return (
      categories.find((category) =>
        data.report?.categories[category].files.some((file) => file[focus] > 0),
      ) ?? "models"
    );
  }, [data.report, focus]);

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
  const StatusIcon = getStatusIcon(data.status);

  return (
    <div className="rounded-2xl bg-slate-950 px-4 text-ink font-sans space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8 gap-4">
        <div className="mt-2 text-ink-muted">
          <span className="ml-2">
            {data.report?.totals.files || 0} files linted ·{" "}
            {data.report?.totals.lines} lines scanned · {relativeTime}
          </span>
        </div>
        {data.report && (
          <button
            type="button"
            onClick={() => downloadReportCSV(data)}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-4 py-2 mt-4 text-sm font-medium text-foreground transition-colors hover:bg-slate-800"
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </button>
        )}
      </div>

      {/* Score and Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex justify-center md:col-span-1">
          <ScoreGauge score={data.score} status={data.status} />
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-slate-800 bg-slate-900 p-4">
              <div className="text-xs text-muted-foreground">Errors</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-400">
                  {data.errors}
                </span>
              </div>
            </Card>
            <Card className="border border-slate-800 bg-slate-900 p-4">
              <div className="text-xs text-muted-foreground">Warnings</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400">
                  {data.warnings}
                </span>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Files Linted</p>
              <p className="font-semibold text-foreground">
                {data.report?.totals.files || 0}
              </p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Lines Scanned</p>
              <p className="font-semibold text-foreground">
                {data.report?.totals.lines || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Score Trend */}
      {data.scoreHistory && data.scoreHistory.length > 0 && (
        <Card className="border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Score trend (weekly)
            </span>
            {data.scoreHistory.length >= 2 && (
              <span
                className={`text-xs font-medium ${
                  data.scoreHistory[data.scoreHistory.length - 1].score >=
                  data.scoreHistory[0].score
                    ? "text-emerald-400"
                    : "text-red-400"
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
        <Card
          id="report"
          className="scroll-mt-6 border border-slate-800 bg-slate-900 p-0 overflow-x-hidden"
        >
          <Tabs defaultValue={focusedCategory} className="w-full">
            <TabsList className="border-b border-hairline bg-slate-950 rounded-none p-0 h-auto gap-6 w-full justify-start">
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
                  focus={focus}
                />
              </TabsContent>
              <TabsContent value="tests" className="m-0">
                <CategorySection
                  category="Tests"
                  data={data.report.categories.tests}
                  focus={focus}
                />
              </TabsContent>
              <TabsContent value="macros" className="m-0">
                <CategorySection
                  category="Macros"
                  data={data.report.categories.macros}
                  focus={focus}
                />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="border border-slate-800 bg-slate-900 p-6">
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
