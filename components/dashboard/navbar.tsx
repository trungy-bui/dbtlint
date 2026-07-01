"use client";

import { Bell, ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type DashboardNavbarProps = {
  title: string;
  user: SupabaseUser
};

export function DashboardNavbar({ title, user }: DashboardNavbarProps) {
  const router = useRouter();
  const supabase = createClient()

  const email = user.email ?? "";
  const fullName = user.user_metadata.full_name
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out!");
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="text-sm font-medium text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell />
              <span className="sr-only">Notifications</span>
              <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary">3 new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">
                  Scan failed · marketing-models
                </span>
                <span className="text-xs text-muted-foreground">
                  5 errors found on feat/attribution · 2h ago
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">
                  Scan passed · analytics-core
                </span>
                <span className="text-xs text-muted-foreground">
                  All rules passed on main · 4h ago
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">New rule available</span>
                <span className="text-xs text-muted-foreground">
                  enforce-incremental-strategy · 1d ago
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-1.5 md:pr-2.5">
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="rounded-md bg-primary/15 text-xs font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-xs font-medium">{fullName}</span>
                <span className="text-[11px] text-muted-foreground">
                  {email}
                </span>
              </div>
              <ChevronsUpDown className="hidden text-muted-foreground md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{fullName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings")}
              >
                <User />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/settings")}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}