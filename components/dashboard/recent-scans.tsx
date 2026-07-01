"use client"

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
import { getTimeAgo } from "@/lib/utils/time";

interface RecentScansProps {
  recentScans: RecentScan[];
}

export function RecentScansTable({ recentScans }: RecentScansProps) {
  return (
    <Card className="gap-0 overflow-hidden py-3">
      <CardHeader className="border-b border-border p-5">
        <CardTitle>Recent Scans</CardTitle>
        <CardDescription>
          Linting results from your latest dbt project runs.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">Project</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="text-right">Warnings</TableHead>
            <TableHead className="pr-5 text-right">Status</TableHead>
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
              className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
            >
              <TableCell className="pl-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {scan.project}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getTimeAgo(scan.createdAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={cn(
                    scan.errors > 0
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {scan.errors}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {scan.warnings}
              </TableCell>
              <TableCell className="pr-5 text-right">
                {scan.status === "passed" ? (
                  <Badge className="bg-primary/10 text-primary">
                    <CheckCircle2 />
                    Passed
                  </Badge>
                ) : (
                  <Badge variant="destructive">
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
