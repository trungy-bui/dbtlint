import type { User } from "@supabase/supabase-js";
import { Suspense } from "react";

import { getDashboardStats, getRecentScans } from "@/lib/dashboard";
import { getUploadPlanState } from "@/lib/upload-plan";
import { UploadZone } from "../shared/dropzone";
import { DashboardOverview } from "./dashboard-overview";
import { RecentScansTable } from "./recent-scans";
import {
  DashboardStatsSkeleton,
  RecentScansSkeleton,
  UploadPanelSkeleton,
} from "./route-loading";

type DashboardProps = {
  user: User;
};

async function DashboardStats({
  fullName,
  userId,
}: {
  fullName: string;
  userId: string;
}) {
  const dashboardStats = await getDashboardStats(userId);

  return (
    <DashboardOverview fullName={fullName} dashboardStats={dashboardStats} />
  );
}

async function RecentScans({ userId }: { userId: string }) {
  const recentScans = await getRecentScans(userId);

  return <RecentScansTable recentScans={recentScans} />;
}

async function CompactUpload({ userId }: { userId: string }) {
  const uploadPlanState = await getUploadPlanState(userId);

  return (
    <UploadZone compact existingProjects={uploadPlanState.existingProjects} />
  );
}

export function Dashboard({ user }: DashboardProps) {
  const fullName = user.user_metadata.full_name ?? user.email ?? "there";

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats fullName={fullName} userId={user.id} />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Suspense fallback={<RecentScansSkeleton />}>
            <RecentScans userId={user.id} />
          </Suspense>
        </div>
        <Suspense fallback={<UploadPanelSkeleton />}>
          <CompactUpload userId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}
