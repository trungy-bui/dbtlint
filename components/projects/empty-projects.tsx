"use client";

import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type EmptyProjectsProps = {
  onUpload?: () => void;
};

export function EmptyProjects({ onUpload }: EmptyProjectsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Empty className="overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-16 text-slate-100">
        <EmptyHeader>
          <EmptyMedia>
            <Image
              src="/empty-projects.png"
              alt="An empty project box illustration"
              width={180}
              height={180}
              className="opacity-75 grayscale"
              unoptimized
            />
          </EmptyMedia>
          <EmptyTitle className="text-lg font-semibold text-slate-100">
            No projects yet
          </EmptyTitle>
          <EmptyDescription className="max-w-md leading-6 text-slate-400">
            Upload your first dbt project to start catching errors and enforcing
            conventions across your models.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            onClick={onUpload}
            className="h-11 cursor-pointer bg-emerald-400 px-5 font-semibold text-slate-950 hover:bg-emerald-300"
          >
            <Upload data-icon="inline-start" />
            Upload your first dbt project
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}
