import type { User } from "@supabase/supabase-js";

import { getDashboardStats, getRecentScans } from "@/lib/dashboard";
import { UploadZone } from "../shared/dropzone";
import { DashboardOverview } from "./dashboard-overview";
import { RecentScansTable } from "./recent-scans";

type DashboardProps = {
  user: User;
};

export async function Dashboard({ user }: DashboardProps) {
  const fullName = user.user_metadata.full_name ?? user.email ?? "there";
  const [dashboardStats, recentScans] = await Promise.all([
    getDashboardStats(user.id),
    getRecentScans(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <DashboardOverview fullName={fullName} dashboardStats={dashboardStats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentScansTable recentScans={recentScans} />
        </div>
        <UploadZone compact />
      </div>
    </div>
  );
}
