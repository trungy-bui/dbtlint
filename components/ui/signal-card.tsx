import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type SignalCardProps = Omit<React.ComponentProps<"article">, "title"> & {
  icon: LucideIcon;
  label: React.ReactNode;
  metric: React.ReactNode;
  description?: React.ReactNode;
  footer: React.ReactNode;
  metricClassName?: string;
};

export function SignalCard({
  icon: Icon,
  label,
  metric,
  description,
  footer,
  className,
  metricClassName,
  ...props
}: SignalCardProps) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-6 shadow-[0_18px_48px_rgba(2,6,23,0.22),inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,box-shadow] duration-200 ease-out hover:border-emerald-400/35 hover:bg-slate-900 hover:shadow-[0_20px_54px_rgba(2,6,23,0.32),0_0_0_1px_rgba(52,211,153,0.06)]",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/55 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-surface-nested text-emerald-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_20px_rgba(52,211,153,0.06)]">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <span className="terminal-label pt-1 text-right">{label}</span>
      </div>

      <div className="mt-7 flex flex-1 flex-col">
        <div
          className={cn(
            "text-xl font-semibold tracking-[-0.025em] text-slate-50",
            metricClassName,
          )}
        >
          {metric}
        </div>
        {description ? (
          <div className="mt-3 text-sm leading-6 text-slate-400">
            {description}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex min-h-6 items-center gap-2 border-t border-surface-border pt-4 font-mono text-[11px] text-slate-400">
        {footer}
      </div>
    </article>
  );
}
