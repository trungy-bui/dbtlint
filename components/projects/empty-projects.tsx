"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

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
      <Empty className="border border-dashed border-border bg-card/40 py-16">
        <EmptyHeader>
          <EmptyMedia>
            <Image
              src="/empty-projects.png"
              alt="An empty project box illustration"
              width={180}
              height={180}
              className="opacity-90"
              unoptimized
            />
          </EmptyMedia>
          <EmptyTitle className="text-base">No projects yet</EmptyTitle>
          <EmptyDescription>
            Upload your first dbt project to start catching errors and enforcing
            conventions across your models.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onUpload}>
            <Upload data-icon="inline-start" />
            Upload your first dbt project
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}
