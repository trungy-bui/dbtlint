"use client";

import { motion } from "framer-motion";
import {
  FolderGit2,
  type LucideIcon,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";

import type { DashboardStat, DashboardStatValues } from "@/lib/dashboard";
import { StatCard } from "./stats-card";

const statCards: Stat[] = [
  {
    label: "Total Projects",
    icon: FolderGit2,
    hint: "vs. last month",
  },
  {
    label: "Total Scans",
    icon: ScanLine,
    hint: "vs. last month",
  },
  {
    label: "Errors Found",
    icon: ShieldAlert,
    hint: "vs. last month",
  },
  {
    label: "Warnings Found",
    icon: ShieldCheck,
    hint: "vs. last month",
  },
];

type Stat = {
  label: DashboardStat;
  icon: LucideIcon;
  hint: string;
};

type DashboardOverviewProps = {
  fullName: string;
  dashboardStats: DashboardStatValues;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardOverview({
  fullName,
  dashboardStats,
}: DashboardOverviewProps) {
  const [greeting, setGreeting] = React.useState("Good morning");

  React.useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-1"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-balance">
          {greeting}, {fullName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your dbt projects today.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const dashboardStat = dashboardStats[stat.label];

          return (
            <StatCard
              key={stat.label}
              stat={{ ...stat, ...dashboardStat }}
              value={dashboardStat.value}
              index={index}
            />
          );
        })}
      </div>
    </>
  );
}
