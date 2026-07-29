"use client";

import { motion } from "framer-motion";
import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SignalCard } from "@/components/ui/signal-card";
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
      <SignalCard
        icon={Icon}
        label={stat.label}
        metric={<span className="tabular-nums">{value}</span>}
        metricClassName="font-mono text-3xl tracking-[-0.04em]"
        footer={
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                stat.trendDirection === "up" && "text-emerald-300",
                stat.trendDirection === "down" && "text-rose-300",
                stat.trendDirection === "flat" && "text-slate-300",
              )}
            >
              <TrendIcon aria-hidden="true" className="size-3.5" />
              {stat.trend}
            </span>
            <span className="text-slate-400">{stat.hint}</span>
          </>
        }
      />
    </motion.div>
  );
}
