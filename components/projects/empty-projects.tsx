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
            className="relative h-10 w-full cursor-pointer bg-emerald-400 text-xs font-semibold text-slate-950 
    border-2 border-transparent
    transition-all duration-300 ease-out
    hover:-translate-y-0.5 hover:bg-emerald-300
    hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]
    active:translate-y-0 active:scale-[0.98] active:bg-emerald-500
    active:shadow-[0_0_10px_rgba(52,211,153,0.3)]"
          >
            <Upload data-icon="inline-start" />
            Upload your first dbt project
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}
