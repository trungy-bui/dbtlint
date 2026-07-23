import { DashboardNavbar } from "@/components/dashboard/navbar";
import { NotificationsListener } from "@/components/dashboard/notifications-listener";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getUser } from "@/lib/auth";
import { getNotifications, getScanById } from "@/lib/dashboard";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  if (!user) return;
  const [initialPlanUsage, notifications] = await Promise.all([
    getInitialPlanUsage(user.id),
    getNotifications(user.id).then((userNotifications) =>
      Promise.all(
        userNotifications.map(async (notification) => {
          if (!notification.scanId) {
            return { ...notification };
          }

          const [scanInfo] = await getScanById(notification.scanId);
          return {
            ...notification,
            scanInfo,
          };
        }),
      ),
    ),
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
