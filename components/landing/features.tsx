"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Braces,
  Gauge,
  GitPullRequest,
  Layers3,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";

const features = [
  {
    icon: GitPullRequest,
    label: "CI native",
    title: "Make quality part of every pull request",
    description:
      "Run the same rule set locally and in CI. Annotate failures where your team already reviews code and block only what matters.",
    detail: "GitHub Actions · GitLab CI · any pipeline",
    span: "lg:col-span-2",
  },
  {
    icon: Braces,
    label: "SQL aware",
    title: "Rules that understand dbt",
    description:
      "Check models, sources, tests, macros, naming, and formatting with context—not brittle text matching.",
    detail: "Models · YAML · Jinja",
    span: "",
  },
  {
    icon: Layers3,
    label: "Configurable",
    title: "Standards that fit your stack",
    description:
      "Start from sensible presets, tune severity by rule, and extend the system with conventions unique to your warehouse.",
    detail: "Presets · overrides · custom packs",
    span: "",
  },
  {
    icon: UsersRound,
    label: "Team aligned",
    title: "One rule set, fewer review loops",
    description:
      "Share configuration across projects so reviewers can focus on business logic instead of whitespace and naming debates.",
    detail: "Shared config · consistent output",
    span: "",
  },
  {
    icon: Gauge,
    label: "Fast feedback",
    title: "Built for the inner loop",
    description:
      "Scan projects in seconds and return file-level findings with line numbers, severity, and a clear path to resolution.",
    detail: "Fast scans · precise locations",
    span: "",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

export function FeaturesSection() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      id="features"
      className="scroll-mt-20 border-y border-slate-800/80 bg-slate-950 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{
            duration: mounted && !reduceMotion ? 0.35 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end"
        >
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
              Built for the review loop
            </p>
            <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl lg:text-5xl">
              Quality checks your team will actually keep enabled.
            </h2>
          </div>
          <p className="max-w-2xl text-pretty text-base leading-7 text-slate-400 lg:justify-self-end lg:text-lg lg:leading-8">
            DBTLint turns your team&apos;s standards into fast, repeatable
            feedback—from the first local check to the final merge gate.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: "-70px" }}
          transition={
            mounted && !reduceMotion
              ? { staggerChildren: 0.06 }
              : { duration: 0, staggerChildren: 0 }
          }
          className="mt-12 grid grid-cols-1 gap-9.5 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.article
              key={feature.title}
              variants={item}
              className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 p-6 transition-colors duration-200 hover:border-slate-700 hover:bg-slate-900 ${feature.span}`}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-emerald-400">
                  <feature.icon aria-hidden="true" className="size-4.5" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {feature.label}
                </span>
              </div>
              <h3 className="mt-8 max-w-md text-xl font-semibold tracking-[-0.02em] text-slate-100">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                {feature.description}
              </p>
              <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 font-mono text-[11px] text-slate-500">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-3.5 text-emerald-400/80"
                />
                {feature.detail}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
