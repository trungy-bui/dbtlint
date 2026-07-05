"use client";

import { motion, type Variants } from "framer-motion";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Upload your project",
    desc: "Drag in your dbt project as a zip or folder. No config, no CLI, no terminal — just drop it in.",
    preview: {
      kind: "upload",
      label: "jaffle-shop-main.zip",
      sub: "Uploading…",
    },
  },
  {
    step: "02",
    title: "We lint it for you",
    desc: "A background job runs SQLFluff against every model, test, and macro in your project — automatically.",
    preview: {
      kind: "processing",
      label: "Running lint…",
      sub: "5 files · 200 lines scanned",
    },
  },
  {
    step: "03",
    title: "See results in seconds",
    desc: "Get a project score, errors, warnings, and file-by-file recommendations — ready in about 6 seconds.",
    preview: {
      kind: "result",
      label: "94 score",
      sub: "0 errors · 10 warnings",
    },
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

function StepPreview({
  preview,
}: {
  preview: (typeof steps)[number]["preview"];
}) {
  if (preview.kind === "upload") {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-white/15 bg-zinc-950/70 px-3 py-2.5">
        <Upload className="h-4 w-4 shrink-0 text-emerald-400" />
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">
            {preview.label}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {preview.sub}
          </p>
        </div>
      </div>
    );
  }

  if (preview.kind === "processing") {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
        <div className="min-w-0">
          <p className="font-mono text-xs text-foreground">{preview.label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {preview.sub}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2.5">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
      <div className="min-w-0">
        <p className="font-mono text-xs text-foreground">{preview.label}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {preview.sub}
        </p>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-transparent"
      />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-sm text-emerald-400">
            no terminal required
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From upload to clean models in three steps
          </h2>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {steps.map((step) => (
            <motion.div
              key={step.step}
              variants={item}
              className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-7"
            >
              <span className="font-mono text-4xl font-semibold text-emerald-500/30">
                {step.step}
              </span>
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
              <StepPreview preview={step.preview} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}