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
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
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
  command: "text-zinc-100",
  muted: "text-zinc-500",
  pass: "text-zinc-100",
  warn: "text-zinc-300",
  fail: "text-rose-300",
};

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-black pb-20 pt-32 sm:pb-24 sm:pt-36 lg:pb-28 lg:pt-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[34rem] w-[70rem] -translate-x-1/2 rounded-full bg-white/[0.08] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <motion.div
        variants={container}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        className="relative mx-auto grid w-full max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16"
      >
        <div>
          <motion.div
            variants={item}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/80 px-3 font-mono text-xs text-zinc-300 shadow-sm"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-40 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            CI checks are passing
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 max-w-2xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
          >
            The quality gate for your{" "}
            <span className="text-white">dbt codebase.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-pretty text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8"
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
              className="h-12 cursor-pointer bg-white px-6 font-semibold text-black shadow-[0_12px_32px_rgba(16,185,129,0.18)] hover:bg-zinc-100"
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
              className="h-12 cursor-pointer border-zinc-800 bg-zinc-950/60 px-6 text-zinc-100 hover:bg-zinc-900 hover:text-white"
            >
              <a href="#how-it-works">See the workflow</a>
            </Button>
          </motion.div>

          <motion.ul
            variants={item}
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400"
          >
            {[
              "No credit card",
              "Works with your CI",
              "Actionable rule output",
            ].map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-3.5 text-white" />
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
            className="absolute -inset-5 rounded-[2rem] bg-white/[0.06] blur-2xl"
          />
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/95 shadow-[0_28px_80px_rgba(2,6,23,0.55)]">
            <div className="flex h-12 items-center justify-between border-b border-zinc-900 px-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-400/80" />
                <span className="size-2.5 rounded-full bg-zinc-300/80" />
                <span className="size-2.5 rounded-full bg-white/80" />
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                <GitPullRequest aria-hidden="true" className="size-3.5" />
                feature/customer-ltv
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-zinc-500">RUN #1842</p>
                  <p className="mt-1 text-sm font-medium text-zinc-100">
                    Pull request quality check
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-100">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  Completed
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-zinc-900 bg-black/80">
                <div className="border-b border-zinc-900 px-4 py-2.5 font-mono text-[11px] text-zinc-500">
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

              <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-900 rounded-xl border border-zinc-900 bg-black/45 py-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="px-2 text-center sm:px-4 sm:text-left"
                  >
                    <p className="font-mono text-sm font-semibold tabular-nums text-zinc-100 sm:text-base">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-zinc-500 sm:text-xs">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-4 -left-3 hidden items-center gap-2 rounded-lg border border-zinc-300/20 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 shadow-xl sm:flex">
            <CircleAlert aria-hidden="true" className="size-4" />2 issues fixed
            before merge
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
