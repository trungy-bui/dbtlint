"use client";

import { Crown, Sparkles } from "lucide-react";
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
    <div className="border border-hairline bg-panel rounded-lg p-4 space-y-3 relative overflow-hidden -translate-y-4">
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      {/* Plan Name */}
      <div className="flex items-center justify-between relative">
        <h3 className="text-sm font-semibold text-ink">Free Plan</h3>
        <span className="text-[10px] font-medium text-ink-muted bg-muted px-1.5 py-0.5 rounded">
          FREE
        </span>
      </div>

      <div className="relative space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-ink-muted">
            {resolvedScansUsed} of {resolvedScansLimit} scans used
          </p>
          <span
            className={`text-xs font-medium ${
              isAtLimit
                ? "text-signal-fail"
                : isNearLimit
                  ? "text-signal-warn"
                  : "text-ink-muted"
            }`}
          >
            {Math.round(usagePercent)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="w-full h-1.5 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Monthly scan usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usagePercent)}
        >
          <div
            aria-hidden="true"
            className={`h-full transition-all duration-300 ease-out rounded-full ${
              isAtLimit
                ? "bg-signal-fail"
                : isNearLimit
                  ? "bg-signal-warn"
                  : "bg-primary"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {isNearLimit && (
          <p className="text-[11px] text-signal-warn flex items-center gap-1 pt-0.5">
            <Sparkles className="w-3 h-3" />
            {isAtLimit ? "You've hit your limit" : "Almost at your limit"}
          </p>
        )}
      </div>

      {/* Upgrade Button */}
      {onUpgrade && (
        <Button
          size="sm"
          onClick={onUpgrade}
          className="w-full text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90 font-medium relative"
        >
          Upgrade to Team
        </Button>
      )}
    </div>
  );
}

export function TeamPlanCard({ onManageBilling }: TeamPlanCardProps) {
  return (
    <div className="border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent rounded-lg p-4 space-y-2.5">
      {/* Plan Badge with Icon */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/15">
          <Crown className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink leading-none">
            Team Plan
          </h3>
          <p className="text-[11px] text-ink-muted mt-0.5">Unlimited scans</p>
        </div>
      </div>

      {/* Manage Link */}
      {onManageBilling && (
        <button
          type="button"
          onClick={onManageBilling}
          className="text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Manage billing →
        </button>
      )}
    </div>
  );
}
