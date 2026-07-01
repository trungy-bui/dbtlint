"use client";

import { motion } from "framer-motion";
import { UploadZone } from "../shared/dropzone";

export function Upload() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Upload a dbt project
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload a ZIP of your dbt project and we&apos;ll lint every model,
          test, and macro against your active rule set.
        </p>
      </div>
      <UploadZone />
    </motion.div>
  );
}
