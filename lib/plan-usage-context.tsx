"use client";

import * as React from "react";
import { FREE_PLAN_SCAN_LIMIT, type Plan } from "@/lib/plan-limits";

export type PlanUsageState = {
  plan: Plan;
  scansUsed: number;
  scansLimit: number;
};

type UserPlanResponse = {
  plan: Plan | null;
  scansUsed: number | null;
  scansLimit: number | null;
};

type PlanUsageContextValue = PlanUsageState & {
  bumpScansUsed: (delta: number) => void;
  refresh: () => Promise<void>;
};

const PlanUsageContext = React.createContext<PlanUsageContextValue | null>(
  null,
);

function normalizePlanUsage(data: UserPlanResponse): PlanUsageState {
  if (data.plan === "team") {
    return {
      plan: "team",
      scansUsed: 0,
      scansLimit: FREE_PLAN_SCAN_LIMIT,
    };
  }

  return {
    plan: "free",
    scansUsed: data.scansUsed ?? 0,
    scansLimit: data.scansLimit ?? FREE_PLAN_SCAN_LIMIT,
  };
}

export function PlanUsageProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: PlanUsageState;
}) {
  const [usage, setUsage] = React.useState(initial);

  const bumpScansUsed = React.useCallback((delta: number) => {
    setUsage((current) => ({
      ...current,
      scansUsed: Math.max(0, current.scansUsed + delta),
    }));
  }, []);

  const refresh = React.useCallback(async () => {
    const response = await fetch("/api/user/plan", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as UserPlanResponse;
    setUsage(normalizePlanUsage(data));
  }, []);

  const value = React.useMemo<PlanUsageContextValue>(
    () => ({
      ...usage,
      bumpScansUsed,
      refresh,
    }),
    [bumpScansUsed, refresh, usage],
  );

  return (
    <PlanUsageContext.Provider value={value}>
      {children}
    </PlanUsageContext.Provider>
  );
}

export function usePlanUsage() {
  const context = React.useContext(PlanUsageContext);

  if (!context) {
    throw new Error("usePlanUsage must be used within PlanUsageProvider");
  }

  return context;
}

export function useOptionalPlanUsage() {
  return React.useContext(PlanUsageContext);
}
