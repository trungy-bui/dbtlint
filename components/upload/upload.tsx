"use client";

import { motion } from "framer-motion";
import type { Plan } from "@/lib/plan-limits";
import { UploadZone } from "../shared/dropzone";

type UploadProps = {
  plan: Plan;
  existingProjects: string[];
  scanCount: number;
};

export function Upload({ plan, existingProjects, scanCount }: UploadProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative isolate mx-auto flex w-full max-w-5xl flex-col gap-8 text-slate-100 before:fixed before:inset-0 before:-z-10 before:bg-slate-950"
    >
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400">
          New lint run
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
          Upload a dbt project
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Upload a ZIP of your dbt project and we&apos;ll lint every model,
          test, and macro against your active rule set.
        </p>
      </div>
      <UploadZone
        plan={plan}
        existingProjects={existingProjects}
        scanCount={scanCount}
      />
    </motion.div>
  );
}
