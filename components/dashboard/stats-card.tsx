"use client";

import { motion } from "framer-motion";
import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardTrendDirection } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  icon: LucideIcon;
  trend: string;
  trendDirection: DashboardTrendDirection;
  hint: string;
};

type StatCardProps = {
  stat: Stat;
  value: number;
  index: number;
};

export function StatCard({ stat, value, index }: StatCardProps) {
  const Icon = stat.icon;
  const TrendIcon =
    stat.trendDirection === "up"
      ? TrendingUp
      : stat.trendDirection === "down"
        ? TrendingDown
        : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
    >
      <Card className="bg-slate-900/60 transition-colors hover:border-primary/40">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {value}
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  stat.trendDirection === "up" && "text-primary",
                  stat.trendDirection === "down" && "text-destructive",
                  stat.trendDirection === "flat" && "text-muted-foreground",
                )}
              >
                <TrendIcon className="size-3.5" />
                {stat.trend}
              </span>
              <span className="text-muted-foreground">{stat.hint}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
