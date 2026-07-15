"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  CheckCircle2,
  FileCode2,
  GitPullRequest,
  ScanSearch,
} from "lucide-react";
import { useEffect, useState } from "react";

const steps = [
  {
    number: "01",
    icon: FileCode2,
    eyebrow: "Connect",
    title: "Point DBTLint at your project",
    description:
      "Upload a dbt project or run the checker from your existing developer workflow. Your folder structure and config stay intact.",
    code: "$ dbtlint check ./analytics",
    status: "Project discovered",
  },
  {
    number: "02",
    icon: ScanSearch,
    eyebrow: "Inspect",
    title: "Scan every relevant asset",
    description:
      "Models, tests, sources, macros, and YAML are checked against the rule set your team selected.",
    code: "42 models · 18 tests · 6 sources",
    status: "66 assets checked",
  },
  {
    number: "03",
    icon: GitPullRequest,
    eyebrow: "Resolve",
    title: "Fix findings before they merge",
    description:
      "Review exact files, line numbers, severity, and remediation guidance. Re-run locally or let CI verify the patch.",
    code: "quality_score: 94 / 100",
    status: "Ready for review",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
  },
};

export function HowItWorksSection() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 bg-slate-950 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{
            duration: mounted && !reduceMotion ? 0.35 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
            From code to confidence
          </p>
          <h2 className="mt-4 max-w-md text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl lg:text-5xl">
            A quality gate, not another workflow.
          </h2>
          <p className="mt-5 max-w-md text-pretty text-base leading-7 text-slate-400">
            Bring DBTLint to the way your team already ships. The feedback stays
            fast, scoped, and close to the code that caused it.
          </p>
          <div className="mt-8 hidden h-px w-24 bg-gradient-to-r from-emerald-400 to-transparent lg:block" />
        </motion.div>

        <motion.ol
          variants={container}
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: "-70px" }}
          transition={
            mounted && !reduceMotion
              ? { staggerChildren: 0.08 }
              : { duration: 0, staggerChildren: 0 }
          }
          className="relative space-y-12 before:absolute before:bottom-10 before:left-7 before:top-10 before:w-px before:bg-slate-800 sm:before:left-9"
        >
          {steps.map((step) => (
            <motion.li
              key={step.number}
              variants={item}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/55 p-5 transition-colors duration-200 hover:border-slate-700 sm:p-8"
            >
              <div className="grid gap-6 sm:grid-cols-[3.5rem_1fr]">
                <span className="relative z-10 flex size-14 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 font-mono text-xs font-semibold text-emerald-400 shadow-[0_0_0_6px_#020617] sm:size-[4.5rem]">
                  {step.number}
                </span>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500">
                      <step.icon
                        aria-hidden="true"
                        className="size-4 text-emerald-400"
                      />
                      {step.eyebrow}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                      <CheckCircle2 aria-hidden="true" className="size-3.5" />
                      {step.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-100">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {step.description}
                  </p>
                  <div className="mt-5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 font-mono text-xs text-slate-300">
                    <span className="text-emerald-400">›</span> {step.code}
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
