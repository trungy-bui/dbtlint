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
import { usePlanUsage } from "@/lib/plan-usage-context";
import { createClient } from "@/lib/supabase/client";
import { FreePlanCard, TeamPlanCard } from "./plan-status-widget";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/rules", label: "Rules", icon: Shield },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const planUsage = usePlanUsage();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out!");
    router.push("/login");
  }

  return (
    <Sidebar className="border-slate-800 bg-slate-950 text-slate-300 [&_[data-sidebar=sidebar]]:bg-slate-950">
      <SidebarHeader className="border-b border-slate-800 p-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
            <Terminal className="size-4.5 text-emerald-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-sm font-semibold text-slate-50">
              dbt<span className="text-emerald-400">lint</span>
            </span>
            <span className="text-[11px] text-slate-500">
              dbt project linting
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-slate-950">
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    className="min-h-10 cursor-pointer text-slate-400 transition-colors duration-200 hover:bg-slate-900 hover:text-slate-100 data-[active=true]:bg-emerald-400/10 data-[active=true]:text-emerald-300"
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

      <SidebarFooter className="border-t border-slate-800 bg-slate-950 pb-3">
        <div className="px-2">
          {planUsage.plan === "team" ? (
            <TeamPlanCard onManageBilling={() => router.push("/billing")} />
          ) : (
            <FreePlanCard onUpgrade={() => router.push("/billing")} />
          )}
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="min-h-10 cursor-pointer text-slate-400 hover:bg-slate-900 hover:text-slate-100 data-[active=true]:bg-emerald-400/10 data-[active=true]:text-emerald-300"
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
            <SidebarMenuButton
              className="min-h-10 cursor-pointer text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"
              tooltip="Sign out"
              onClick={handleSignOut}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
