"use client";

import { Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptionalPlanUsage } from "@/lib/plan-usage-context";

interface FreePlanCardProps {
  scansUsed?: number;
  scansLimit?: number;
  onUpgrade?: () => void;
}

interface TeamPlanCardProps {
  onManageBilling?: () => void;
}

export function FreePlanCard({
  scansUsed,
  scansLimit,
  onUpgrade,
}: FreePlanCardProps) {
  const planUsage = useOptionalPlanUsage();
  const resolvedScansUsed = scansUsed ?? planUsage?.scansUsed ?? 0;
  const resolvedScansLimit = scansLimit ?? planUsage?.scansLimit ?? 5;
  const usagePercent =
    resolvedScansLimit > 0
      ? Math.min((resolvedScansUsed / resolvedScansLimit) * 100, 100)
      : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className="group relative space-y-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-colors duration-300 hover:border-slate-700">
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-emerald-400/10 blur-2xl transition-opacity duration-500 group-hover:bg-emerald-400/20" />

      {/* Plan Name */}
      <div className="flex items-center justify-between relative">
        <h3 className="text-sm font-semibold text-slate-100">Free plan</h3>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
          FREE
        </span>
      </div>

      <div className="relative space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-slate-400">
            {resolvedScansUsed} of {resolvedScansLimit} scans used
          </p>
          <span
            className={`text-xs font-medium ${
              isAtLimit
                ? "text-rose-300"
                : isNearLimit
                  ? "text-amber-300"
                  : "text-slate-500"
            }`}
          >
            {Math.round(usagePercent)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label="Monthly scan usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usagePercent)}
        >
          <div
            aria-hidden="true"
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isAtLimit
                ? "bg-rose-400"
                : isNearLimit
                  ? "bg-amber-300"
                  : "bg-emerald-400"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {isNearLimit && (
          <p className="flex animate-in items-center gap-1 fade-in slide-in-from-top-1 pt-0.5 text-[11px] text-amber-300 duration-300">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {isAtLimit ? "You've hit your limit!" : "Almost at your limit"}
          </p>
        )}
      </div>

      {/* Upgrade Button */}
      {onUpgrade && (
        <Button
          size="sm"
          onClick={onUpgrade}
          className="relative h-10 w-full cursor-pointer bg-emerald-400 text-xs font-semibold text-slate-950 
    border-2 border-transparent
    transition-all duration-300 ease-out
    hover:-translate-y-0.5 hover:bg-emerald-300
    hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]
    active:translate-y-0 active:scale-[0.98] active:bg-emerald-500
    active:shadow-[0_0_10px_rgba(52,211,153,0.3)]"
        >
          Upgrade to Team
        </Button>
      )}
    </div>
  );
}

export function TeamPlanCard({ onManageBilling }: TeamPlanCardProps) {
  return (
    <div className="group relative space-y-2.5 overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
      {/* Plan Badge with Icon */}
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-emerald-400/10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
          <Rocket className="size-3.5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-none text-slate-100">
            Team Plan
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">Unlimited scans</p>
        </div>
      </div>

      {/* Manage Link */}
      {onManageBilling && (
        <button
          type="button"
          onClick={onManageBilling}
          className="group/btn min-h-9 cursor-pointer rounded-md text-xs text-slate-400 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Manage billing{" "}
          <span className="inline-block transition-transform duration-200 group-hover/btn:translate-x-0.5">
            →
          </span>
        </button>
      )}
    </div>
  );
}