import {
  DashboardStatsSkeleton,
  RecentScansSkeleton,
  UploadPanelSkeleton,
} from "@/components/dashboard/route-loading";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardStatsSkeleton />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentScansSkeleton />
        </div>
        <UploadPanelSkeleton />
      </div>
    </div>
  );
}
