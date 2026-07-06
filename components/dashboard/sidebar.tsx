"use client";

import {
  CreditCard,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Settings,
  Shield,
  Terminal,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/client";
import { FreePlanCard, TeamPlanCard } from "./plan-status-widget";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type Plan = "free" | "team";

type PlanStatus = {
  plan: Plan;
  scansUsed: number;
  scansLimit: number;
};

type UserPlanResponse = {
  plan: Plan | null;
  scansUsed: number | null;
  scansLimit: number | null;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/rules", label: "Rules", icon: Shield },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const fallbackPlanStatus: PlanStatus = {
  plan: "free",
  scansUsed: 0,
  scansLimit: FREE_PLAN_SCAN_LIMIT,
};

async function fetchPlanStatus(): Promise<PlanStatus> {
  try {
    const response = await fetch("/api/user/plan", { cache: "no-store" });

    if (!response.ok) {
      return fallbackPlanStatus;
    }

    const data = (await response.json()) as UserPlanResponse;

    if (data.plan === "team") {
      return {
        plan: "team",
        scansUsed: 0,
        scansLimit: FREE_PLAN_SCAN_LIMIT,
      };
    }

    return {
      plan: "free",
      scansUsed: data.scansUsed ?? 0,
      scansLimit: data.scansLimit ?? FREE_PLAN_SCAN_LIMIT,
    };
  } catch (error) {
    console.error("fetchPlanStatus: network request failed", error);
    return fallbackPlanStatus;
  }
}

function PlanStatusSkeleton() {
  return (
    <div className="border border-hairline bg-panel rounded-lg p-4 space-y-3 opacity-70">
      <div>
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="mt-2 h-3 w-36 rounded bg-muted" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted" />
      <div className="h-8 w-full rounded-md border border-hairline bg-muted/40" />
    </div>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [planStatus, setPlanStatus] = useState<PlanStatus>(fallbackPlanStatus);
  const [isPlanStatusLoading, setIsPlanStatusLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let planRequestId = 0;

    async function updatePlanStatus(sessionExists: boolean) {
      const requestId = ++planRequestId;

      if (!isMounted) {
        return;
      }

      if (!sessionExists) {
        setPlanStatus(fallbackPlanStatus);
        setIsPlanStatusLoading(false);
        return;
      }

      setIsPlanStatusLoading(true);
      const nextPlanStatus = await fetchPlanStatus();

      if (!isMounted || requestId !== planRequestId) {
        return;
      }

      setPlanStatus(nextPlanStatus);
      setIsPlanStatusLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void updatePlanStatus(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void updatePlanStatus(Boolean(session));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out!");
    router.push("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Terminal className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">
              DBTLint
            </span>
            <span className="text-xs text-muted-foreground">
              dbt project linting
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2">
          {isPlanStatusLoading ? (
            <PlanStatusSkeleton />
          ) : planStatus.plan === "team" ? (
            <TeamPlanCard onManageBilling={() => router.push("/billing")} />
          ) : (
            <FreePlanCard
              scansUsed={planStatus.scansUsed}
              scansLimit={planStatus.scansLimit}
              onUpgrade={() => router.push("/billing")}
            />
          )}
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
            >
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" onClick={handleSignOut}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
