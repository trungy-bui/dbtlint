import { DashboardNavbar } from "@/components/dashboard/navbar";
import { NotificationsListener } from "@/components/dashboard/notifications-listener";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getUser } from "@/lib/auth";
import { getNotifications, getScansByIds } from "@/lib/dashboard";
import { getCombinedScanUsage, getUserPlan } from "@/lib/plan";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";
import {
  PlanUsageProvider,
  type PlanUsageState,
} from "@/lib/plan-usage-context";

async function getInitialPlanUsage(userId: string): Promise<PlanUsageState> {
  const [plan, scansUsed] = await Promise.all([
    getUserPlan(userId),
    getCombinedScanUsage(userId),
  ]);

  if (plan === "team") {
    return {
      plan: "team",
      scansUsed: 0,
      scansLimit: FREE_PLAN_SCAN_LIMIT,
    };
  }

  return {
    plan: "free",
    scansUsed,
    scansLimit: FREE_PLAN_SCAN_LIMIT,
  };
}

async function getNotificationsWithScanInfo(userId: string) {
  const notifications = await getNotifications(userId);
  const scanIds = notifications.flatMap(({ scanId }) =>
    scanId ? [scanId] : [],
  );
  const scanInfos = await getScansByIds(scanIds);
  const scanInfoById = new Map(
    scanInfos.map((scanInfo) => [scanInfo.scanId, scanInfo]),
  );

  return notifications.map((notification) => ({
    ...notification,
    scanInfo: notification.scanId
      ? scanInfoById.get(notification.scanId)
      : undefined,
  }));
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  if (!user) return;
  const [initialPlanUsage, notifications] = await Promise.all([
    getInitialPlanUsage(user.id),
    getNotificationsWithScanInfo(user.id),
  ]);

  return (
    <SidebarProvider>
      <TooltipProvider>
        <PlanUsageProvider initial={initialPlanUsage}>
          <DashboardSidebar />
          <SidebarInset>
            <DashboardNavbar
              title="Dashboard"
              user={user}
              notifications={notifications}
            />
            <NotificationsListener userId={user.id} />
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
              {children}
            </main>
          </SidebarInset>
        </PlanUsageProvider>
      </TooltipProvider>
    </SidebarProvider>
  );
}
