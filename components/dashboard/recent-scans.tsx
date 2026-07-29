"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ScanSearch, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecentScan } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { TimeAgo } from "../ui/time-ago";

interface RecentScansProps {
  recentScans: RecentScan[];
}

type ScanFilter = "errors" | "warnings";

export function RecentScansTable({ recentScans }: RecentScansProps) {
  const router = useRouter();

  const navigateToScan = (scanId: string, filter?: ScanFilter) => {
    // TODO: Read the filter query parameter on the scan detail page and preselect the matching results.
    const query = filter ? `?filter=${filter}` : "";
    router.push(`/projects/${scanId}${query}`);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    scanId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToScan(scanId);
    }
  };

  const handleCountClick = (
    event: MouseEvent<HTMLButtonElement>,
    scanId: string,
    filter: ScanFilter,
  ) => {
    event.stopPropagation();
    navigateToScan(scanId, filter);
  };

  const handleCountKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    scanId: string,
    filter: ScanFilter,
  ) => {
    event.stopPropagation();

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToScan(scanId, filter);
    }
  };

  return (
    <Card className="gap-0 overflow-hidden bg-surface-card py-0 text-slate-100">
      <CardHeader className="border-b border-surface-border p-5 sm:p-6">
        <p className="terminal-label text-emerald-400">Latest activity</p>
        <CardTitle className="text-slate-100">Recent scans</CardTitle>
        <CardDescription className="text-slate-400">
          Linting results from your latest dbt project runs.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={() => router.push("/projects")}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      {recentScans.length === 0 ? (
        <div className="m-4 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-nested px-6 py-10 text-center sm:m-6">
          <span className="flex size-12 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <ScanSearch aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-100">
            No scans to show yet
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
            Upload a dbt project to populate this activity feed with scores,
            errors, and warnings.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-surface-border bg-surface-nested hover:bg-surface-nested">
              <TableHead className="pl-5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Project
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Date
              </TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Errors
              </TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Warnings
              </TableHead>
              <TableHead className="pr-5 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentScans.map((scan, index) => (
              // biome-ignore lint/a11y/useSemanticElements: Table semantics require a tr; keyboard and focus behavior mirror a button.
              <motion.tr
                key={scan.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.15 + index * 0.05,
                  ease: "easeOut",
                }}
                role="button"
                tabIndex={0}
                aria-label={`View scan details for ${scan.project}`}
                onClick={() => navigateToScan(scan.scanId)}
                onKeyDown={(event) => handleRowKeyDown(event, scan.scanId)}
                className="cursor-pointer border-b border-surface-border transition-colors duration-200 last:border-0 hover:bg-slate-800/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70 motion-reduce:transition-none"
              >
                <TableCell className="pl-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-100">
                      {scan.project}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-slate-400">
                  <TimeAgo date={scan.createdAt} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <button
                    type="button"
                    aria-label={`View ${scan.errors} errors for ${scan.project}`}
                    onClick={(event) =>
                      handleCountClick(event, scan.scanId, "errors")
                    }
                    onKeyDown={(event) =>
                      handleCountKeyDown(event, scan.scanId, "errors")
                    }
                    className={cn(
                      "cursor-pointer rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70",
                      scan.errors > 0
                        ? "font-medium text-rose-300"
                        : "text-slate-500",
                    )}
                  >
                    {scan.errors}
                  </button>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  <button
                    type="button"
                    aria-label={`View ${scan.warnings} warnings for ${scan.project}`}
                    onClick={(event) =>
                      handleCountClick(event, scan.scanId, "warnings")
                    }
                    onKeyDown={(event) =>
                      handleCountKeyDown(event, scan.scanId, "warnings")
                    }
                    className="cursor-pointer rounded-sm text-amber-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    {scan.warnings}
                  </button>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {scan.status === "passed" ? (
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      <CheckCircle2 />
                      Passed
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className="border border-rose-400/20 bg-rose-400/10 text-rose-300"
                    >
                      <XCircle />
                      Failed
                    </Badge>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
