"use client";

import { useEffect, useState } from "react";
import type { LintReportJson } from "@/db/schema";

const SCAN_STATUS_POLL_INTERVAL_MS = 9_000;

export type ScanStatusResponse = {
  scanId: string;
  status: "processing" | "passed" | "failed";
  score: number;
  errors: number;
  warnings: number;
  report: LintReportJson | null;
};

export function useScanStatusPolling(scanIds: readonly string[]) {
  const [statuses, setStatuses] = useState<Record<string, ScanStatusResponse>>(
    {},
  );
  const scanIdsKey = JSON.stringify(scanIds);

  useEffect(() => {
    const requestedScanIds = JSON.parse(scanIdsKey) as string[];
    if (requestedScanIds.length === 0) return;

    let controller: AbortController | null = null;

    const fetchStatuses = async () => {
      controller?.abort();
      controller = new AbortController();

      const responses = await Promise.all(
        requestedScanIds.map(async (scanId) => {
          try {
            const response = await fetch(
              `/api/scans/${encodeURIComponent(scanId)}`,
              {
                cache: "no-store",
                signal: controller?.signal,
              },
            );

            if (!response.ok) return null;
            return (await response.json()) as ScanStatusResponse;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              return null;
            }

            console.error("Failed to refresh scan status", { error, scanId });
            return null;
          }
        }),
      );
      const nextStatuses = responses.filter(
        (scan): scan is ScanStatusResponse => scan !== null,
      );

      if (nextStatuses.length === 0) return;
      setStatuses((current) => {
        const next = { ...current };
        for (const scan of nextStatuses) next[scan.scanId] = scan;
        return next;
      });
    };

    void fetchStatuses();
    const interval = window.setInterval(
      () => void fetchStatuses(),
      SCAN_STATUS_POLL_INTERVAL_MS,
    );

    return () => {
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [scanIdsKey]);

  return statuses;
}
