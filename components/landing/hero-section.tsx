"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "../shared/brand-icons";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const terminalLines = [
  { id: "command", text: "$ dbt-lint run --strict", tone: "prompt" },
  { id: "scan", text: "Scanning models/ ...", tone: "muted" },
  { id: "stg-orders", text: "✔ staging/stg_orders.sql", tone: "pass" },
  { id: "stg-customers", text: "✔ staging/stg_customers.sql", tone: "pass" },
  {
    id: "fct-orders-warning",
    text: "⚠ marts/fct_orders.sql:14  L016 keyword not lowercase",
    tone: "warn",
  },
  {
    id: "dim-users-error",
    text: "✖ marts/dim_users.sql:8  L003 expected indentation",
    tone: "fail",
  },
  { id: "spacer", text: "", tone: "muted" },
  { id: "summary", text: "2 passed · 1 warning · 1 error", tone: "summary" },
] as const;

const ratingStars = ["star-1", "star-2", "star-3", "star-4", "star-5"];

const toneClass: Record<string, string> = {
  prompt: "text-emerald-400",
  muted: "text-zinc-500",
  pass: "text-emerald-300",
  warn: "text-amber-300",
  fail: "text-rose-400",
  summary: "text-zinc-300",
};

const lineContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.6 },
  },
};

const lineItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Background gradient + blobs */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-background" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/15 blur-3xl"
        animate={{ x: [0, 50, 0], y: [0, 30, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-32 h-[26rem] w-[26rem] rounded-full bg-sky-500/15 blur-3xl"
        animate={{ x: [0, -40, 0], y: [0, 40, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center"
      >
        <motion.a
          variants={item}
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
        >
          <span className="flex size-1.5 rounded-full bg-emerald-400" />
          dbt-lint v2.0 — now with CI/CD checks
        </motion.a>

        <motion.h1
          variants={item}
          className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          Lint your dbt projects.{" "}
          <span className="text-emerald-400">Ship with confidence.</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          Catch SQL style issues, enforce conventions, and keep your data models
          clean — automatically, on every commit. Built for data engineers who
          care about quality.
        </motion.p>

        <motion.div
          variants={item}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              asChild
              size="lg"
              className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            >
              <a href="/register">
                Start linting free
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button asChild variant="outline" size="lg">
              <a href="#how-it-works">
                <GitHubIcon className="size-4" />
                View on GitHub
              </a>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1 text-amber-300">
            {ratingStars.map((star) => (
              <Star key={star} className="size-3.5 fill-current" />
            ))}
          </span>
          Trusted by 4,000+ data teams
        </motion.div>

        {/* Terminal mockup */}
        <motion.div
          variants={item}
          className="mt-16 w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 shadow-2xl shadow-emerald-500/5 backdrop-blur"
        >
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <span className="size-3 rounded-full bg-rose-500/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-xs text-zinc-500">
              dbt-lint — analytics-pipeline
            </span>
          </div>
          <motion.div
            variants={lineContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-1.5 p-5 text-left font-mono text-sm leading-relaxed"
          >
            {terminalLines.map((line) => (
              <motion.span
                key={line.id}
                variants={lineItem}
                className={toneClass[line.tone]}
              >
                {line.text === "" ? "\u00A0" : line.text}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
