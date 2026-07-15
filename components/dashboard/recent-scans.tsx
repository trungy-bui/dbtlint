"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
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

export function RecentScansTable({ recentScans }: RecentScansProps) {
  return (
    <Card className="gap-0 overflow-hidden border border-slate-800 bg-slate-900/60 py-0 text-slate-100 shadow-none ring-0">
      <CardHeader className="border-b border-slate-800 p-5 sm:p-6">
        <CardTitle className="text-slate-100">Recent scans</CardTitle>
        <CardDescription className="text-slate-400">
          Linting results from your latest dbt project runs.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 bg-slate-950/40 hover:bg-slate-950/40">
            <TableHead className="pl-5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Project
            </TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Date
            </TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Errors
            </TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Warnings
            </TableHead>
            <TableHead className="pr-5 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recentScans.map((scan, index) => (
            <motion.tr
              key={scan.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.15 + index * 0.05,
                ease: "easeOut",
              }}
              className="border-b border-slate-800 transition-colors duration-200 last:border-0 hover:bg-slate-800/55"
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
                <span
                  className={cn(
                    scan.errors > 0
                      ? "font-medium text-rose-300"
                      : "text-slate-500",
                  )}
                >
                  {scan.errors}
                </span>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-amber-300">
                {scan.warnings}
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
    </Card>
  );
}
