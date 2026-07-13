"use client";

import * as React from "react";
import { getTimeAgo } from "@/lib/utils/time";

export function TimeAgo({ date }: { date: string | Date }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setMounted((m) => m), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null; 
  return <>{getTimeAgo(date)}</>;
}
