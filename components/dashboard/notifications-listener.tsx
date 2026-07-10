"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export function NotificationsListener({ userId }: { userId: string }) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    // Requires Supabase Realtime replication on `notifications` and a SELECT
    // RLS policy allowing users to read rows where user_id = auth.uid().
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}
