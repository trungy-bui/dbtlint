"use client";

import { motion } from "framer-motion";
import { UploadZone } from "../shared/dropzone";

type UploadProps = {
  existingProjects: string[];
};

export function Upload({ existingProjects }: UploadProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 text-slate-100"
    >
      <header className="flex flex-col gap-2 pb-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400">
          New lint run
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-50 sm:text-3xl">
          Upload a dbt project
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Upload a ZIP of your dbt project and we&apos;ll lint every model,
          test, and macro against your active rule set.
        </p>
      </header>
      <UploadZone existingProjects={existingProjects} />
    </motion.div>
  );
}
