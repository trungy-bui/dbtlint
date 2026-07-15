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
      <Card className="border border-zinc-900 bg-zinc-950/60 py-5 shadow-none ring-0 transition-colors duration-200 hover:border-zinc-800 hover:bg-zinc-950">
        <CardContent className="flex flex-col gap-5 px-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              {stat.label}
            </span>
            <div className="flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
              <Icon className="size-4.5" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-3xl font-semibold tracking-[-0.04em] tabular-nums text-white">
              {value}
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  stat.trendDirection === "up" && "text-white",
                  stat.trendDirection === "down" && "text-rose-300",
                  stat.trendDirection === "flat" && "text-zinc-500",
                )}
              >
                <TrendIcon className="size-3.5" />
                {stat.trend}
              </span>
              <span className="text-zinc-500">{stat.hint}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
