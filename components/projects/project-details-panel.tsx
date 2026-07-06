"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  File,
  Lightbulb,
  Loader2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LintReportJson } from "@/db/schema";
import { motion } from "framer-motion";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 p-1">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-900">
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
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#71717a", fontSize: 11 }}
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
}: {
  category: string;
  data: LintCategoryReport;
}) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (filePath: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedFiles(newExpanded);
  };

  if (data.skipped) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 py-8 text-center">
        <File className="mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {data.statusMessage ||
            `No ${category.toLowerCase()} found in this dbt project`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {data.files.map((file) => {
        const fileName = file.filePath.split("/").pop() || file.filePath;
        const isExpanded = expandedFiles.has(file.filePath);

        return (
          <Collapsible
            key={file.filePath}
            open={isExpanded}
            onOpenChange={() => toggleFile(file.filePath)}
          >
            <CollapsibleTrigger className="group w-full">
              <div className="flex w-full items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-3 hover:bg-zinc-800">
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180`}
                />
                <File className="size-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">
                    {fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.filePath}
                  </p>
                </div>
                <div className="flex gap-2">
                  {file.errors > 0 && (
                    <Badge
                      variant="destructive"
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      {file.errors} error{file.errors !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {file.warnings > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                      {file.warnings} warning{file.warnings !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-6 border-l border-zinc-800">
              {file.violations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No violations found
                </p>
              ) : (
                file.violations.map((violation) => (
                  <div
                    key={`${violation.code ?? "violation"}-${violation.line_no ?? "line"}-${violation.line_pos ?? "pos"}-${violation.description ?? "description"}`}
                    className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 flex-shrink-0 text-amber-500" />
                      <div className="flex-1">
                        {violation.code && (
                          <p className="font-mono text-xs text-emerald-400">
                            {violation.code}
                          </p>
                        )}
                        <p className="mt-1 text-sm text-foreground">
                          {violation.description}
                        </p>
                        {(violation.line_no !== undefined ||
                          violation.line_pos !== undefined) && (
                          <p className="mt-2 font-mono text-xs text-muted-foreground">
                            Line {violation.line_no || "?"}:
                            {violation.line_pos || "?"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

/**
 * Builds the most common violation across the whole report, grouped by code,
 * using the *actual* sqlfluff description text returned for that code rather
 * than a hardcoded lookup table (sqlfluff codes like LT13, CP01, AL02 etc.
 * vary a lot by ruleset/dialect, so a fixed map would constantly drift out
 * of sync with real output).
 */
function generateRecommendations(data: ProjectDetail): string[] {
  const recommendations: string[] = [];

  type CodeStats = { count: number; description?: string };
  const violationsByCode = new Map<string, CodeStats>();

  if (data.report?.categories) {
    Object.values(data.report.categories).forEach((category) => {
      category.files.forEach((file) => {
        file.violations.forEach((violation) => {
          const code = violation.code ?? "unknown";
          const existing = violationsByCode.get(code);
          violationsByCode.set(code, {
            count: (existing?.count ?? 0) + 1,
            // Keep the first description we see for this code; sqlfluff's
            // description text for a given rule code is generally stable.
            description: existing?.description ?? violation.description,
          });
        });
      });
    });
  }

  if (data.errors > 0) {
    recommendations.push(
      `Fix ${data.errors} error${data.errors !== 1 ? "s" : ""} to improve project quality`,
    );
  }

  const sortedViolations = Array.from(violationsByCode.entries()).sort(
    (a, b) => b[1].count - a[1].count,
  );

  for (const [code, { count, description }] of sortedViolations) {
    if (recommendations.length >= 3) break;

    const label = description
      ? `${description} (${count} occurrence${count !== 1 ? "s" : ""})`
      : `Address "${code}" violation${count !== 1 ? "s" : ""}`;

    if (!recommendations.includes(label)) {
      recommendations.push(label);
    }
  }

  // TODO: Replace with LLM-generated recommendations for more intelligent,
  // context-aware suggestions (e.g. summarizing patterns across files,
  // prioritizing by severity/effort rather than raw frequency).
  if (recommendations.length === 0) {
    recommendations.push(
      "Continue following dbt best practices for optimal project health",
    );
  }

  return recommendations.slice(0, 3);
}

function getStatusIcon(status: "passed" | "failed" | "processing"): string {
  if (status === "passed") return "✓";
  if (status === "failed") return "✗";
  return "▸";
}

export function ProjectDetailPanel({ data }: ProjectDetailPanelProps) {
  const recommendations = useMemo(() => generateRecommendations(data), [data]);
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
  const StatusIcon = getStatusIcon(data.status);

  return (
    <div className="bg-void text-ink font-sans space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8 gap-4">
        <div className="mt-2 text-ink-muted">
          <span className="ml-2">
            {data.report?.totals.files || 0} files linted ·{" "}
            {data.report?.totals.lines} lines scanned · {relativeTime}
          </span>
        </div>
      </div>

      {/* Score and Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex justify-center md:col-span-1">
          <ScoreGauge score={data.score} status={data.status} />
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-xs text-muted-foreground">Errors</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-400">
                  {data.errors}
                </span>
              </div>
            </Card>
            <Card className="border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-xs text-muted-foreground">Warnings</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-400">
                  {data.warnings}
                </span>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Files Linted</p>
              <p className="font-semibold text-foreground">
                {data.report?.totals.files || 0}
              </p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
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
        <Card className="border border-zinc-800 bg-zinc-900 p-4">
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
        <Card className="border border-zinc-800 bg-zinc-900 p-0 overflow-hidden">
          <Tabs defaultValue="models" className="w-full">
            <TabsList className="border-b border-hairline bg-void rounded-none p-0 h-auto gap-6 w-full justify-start">
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
      <Card className="border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="size-5 text-amber-500" />
          <h3 className="font-semibold text-foreground">Recommendations</h3>
        </div>
        <ul className="space-y-3">
          {recommendations.map((rec) => (
            <li
              key={rec}
              className="flex items-start gap-3 text-sm text-muted-foreground"
            >
              <span className="mt-1 inline-block size-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
