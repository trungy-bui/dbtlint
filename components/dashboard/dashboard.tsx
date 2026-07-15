import type { User } from "@supabase/supabase-js";

import { getDashboardStats, getRecentScans } from "@/lib/dashboard";
import { getUploadPlanState } from "@/lib/upload-plan";
import { UploadZone } from "../shared/dropzone";
import { DashboardOverview } from "./dashboard-overview";
import { RecentScansTable } from "./recent-scans";

type DashboardProps = {
  user: User;
};

export async function Dashboard({ user }: DashboardProps) {
  const fullName = user.user_metadata.full_name ?? user.email ?? "there";
  const [dashboardStats, recentScans, uploadPlanState] = await Promise.all([
    getDashboardStats(user.id),
    getRecentScans(user.id),
    getUploadPlanState(user.id),
  ]);

  return (
    <div className="relative isolate flex flex-col gap-6 before:fixed before:inset-0 before:-z-10 before:bg-slate-950">
      <DashboardOverview fullName={fullName} dashboardStats={dashboardStats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentScansTable recentScans={recentScans} />
        </div>
        <UploadZone
          compact
          existingProjects={uploadPlanState.existingProjects}
        />
      </div>
    </div>
  );
}
