"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleAlert,
  GitPullRequest,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const terminalLines = [
  {
    id: "command",
    prefix: "$",
    text: "dbtlint check ./analytics",
    tone: "command",
  },
  {
    id: "scan",
    prefix: "↳",
    text: "42 models · 18 tests · 6 sources",
    tone: "muted",
  },
  {
    id: "pass",
    prefix: "✓",
    text: "models/staging/stg_orders.sql",
    tone: "pass",
  },
  {
    id: "warn",
    prefix: "!",
    text: "L016: keyword must be lowercase",
    tone: "warn",
  },
  {
    id: "path",
    prefix: "",
    text: "models/marts/fct_orders.sql:14",
    tone: "muted",
  },
  {
    id: "fail",
    prefix: "×",
    text: "L003: expected 4-space indentation",
    tone: "fail",
  },
] as const;

const stats = [
  { value: "42", label: "models scanned" },
  { value: "1.8s", label: "total runtime" },
  { value: "94", label: "quality score" },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const toneClass = {
  command: "text-slate-100",
  muted: "text-slate-500",
  pass: "text-emerald-300",
  warn: "text-amber-300",
  fail: "text-rose-300",
};

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative overflow-hidden bg-slate-950 pb-20 pt-24 sm:pb-24 sm:pt-20 lg:pb-20 lg:pt-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[70rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.08] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <motion.div
        variants={container}
        initial={false}
        animate="show"
        transition={
          mounted && !reduceMotion
            ? { staggerChildren: 0.08, delayChildren: 0.05 }
            : { duration: 0, staggerChildren: 0, delayChildren: 0 }
        }
        className="relative mx-auto grid w-full max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16"
      >
        <div>
          <motion.div
            variants={item}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 font-mono text-xs text-slate-300 shadow-sm"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            CI checks are passing
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 max-w-2xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-slate-50 sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
          >
            The quality gate for your{" "}
            <span className="text-emerald-400">dbt codebase.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8"
          >
            Catch risky SQL, enforce team conventions, and stop broken models
            before merge—without turning every pull request into a style debate.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="h-12 cursor-pointer bg-emerald-400 px-6 font-semibold text-slate-950 shadow-[0_12px_32px_rgba(16,185,129,0.18)] hover:bg-emerald-300"
            >
              <Link href="/register">
                Lint your first project
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 cursor-pointer border-slate-700 bg-slate-900/60 px-6 text-slate-100 hover:bg-slate-800 hover:text-white"
            >
              <a href="#how-it-works">See the workflow</a>
            </Button>
          </motion.div>

          <motion.ul
            variants={item}
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400"
          >
            {[
              "No credit card",
              "Works with your CI",
              "Actionable rule output",
            ].map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <Check
                  aria-hidden="true"
                  className="size-3.5 text-emerald-400"
                />
                {label}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          variants={item}
          className="relative mx-auto w-full max-w-2xl lg:max-w-none"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-5 rounded-[2rem] bg-emerald-400/[0.06] blur-2xl"
          />
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-[0_28px_80px_rgba(2,6,23,0.55)]">
            <div className="flex h-12 items-center justify-between border-b border-slate-800 px-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-400/80" />
                <span className="size-2.5 rounded-full bg-amber-300/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <GitPullRequest aria-hidden="true" className="size-3.5" />
                feature/customer-ltv
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-slate-500">RUN #1842</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    Pull request quality check
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  Completed
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
                <div className="border-b border-slate-800 px-4 py-2.5 font-mono text-[11px] text-slate-500">
                  terminal · dbtlint
                </div>
                <div className="space-y-2 overflow-x-auto p-4 font-mono text-xs sm:text-[13px]">
                  {terminalLines.map((line) => (
                    <div
                      key={line.id}
                      className={`flex min-w-max gap-3 ${toneClass[line.tone]}`}
                    >
                      <span className="w-3 shrink-0 text-right">
                        {line.prefix}
                      </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/45 py-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="px-2 text-center sm:px-4 sm:text-left"
                  >
                    <p className="font-mono text-sm font-semibold tabular-nums text-slate-100 sm:text-base">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:text-xs">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-lg border border-amber-300/20 bg-slate-900 px-3 py-2 text-xs text-amber-200 shadow-xl sm:flex">
            <CircleAlert aria-hidden="true" className="size-4" />2 issues fixed
            before merge
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
