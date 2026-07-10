import { and, count, eq, gte, lt } from "drizzle-orm";
import { DashboardNavbar } from "@/components/dashboard/navbar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import db from "@/db";
import { scans, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getNotifications, getScanById } from "@/lib/dashboard";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";
import {
  PlanUsageProvider,
  type PlanUsageState,
} from "@/lib/plan-usage-context";

async function getInitialPlanUsage(userId: string): Promise<PlanUsageState> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [[currentUser], [scanUsage]] = await Promise.all([
    db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ scanCount: count() })
      .from(scans)
      .where(
        and(
          eq(scans.userId, userId),
          gte(scans.createdAt, monthStart),
          lt(scans.createdAt, nextMonthStart),
        ),
      ),
  ]);

  if (currentUser?.plan === "team") {
    return {
      plan: "team",
      scansUsed: 0,
      scansLimit: FREE_PLAN_SCAN_LIMIT,
    };
  }

  return {
    plan: "free",
    scansUsed: scanUsage?.scanCount ?? 0,
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
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
              {children}
            </main>
          </SidebarInset>
        </PlanUsageProvider>
      </TooltipProvider>
    </SidebarProvider>
  );
}
