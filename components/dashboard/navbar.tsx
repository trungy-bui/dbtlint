"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

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
import type { getScanById, Notification } from "@/lib/dashboard";
import { markNotificationsAsRead } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DashboardNotification = Notification & {
  scanInfo?: Awaited<ReturnType<typeof getScanById>>[number];
};

type DashboardNavbarProps = {
  title: string;
  user: SupabaseUser;
  notifications: DashboardNotification[];
};

function formatNotificationTime(date: Date | string | null) {
  if (!date) return "Just now";

  const timestamp = typeof date === "string" ? new Date(date) : date;
  const diffInSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp.getTime()) / 1000),
  );

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86_400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

  return `${Math.floor(diffInSeconds / 86_400)}d ago`;
}

function getNotificationGroup(
  date: Date | string | null,
): "New" | "Earlier" | "Older" {
  if (!date) return "New";

  const timestamp = typeof date === "string" ? new Date(date) : date;
  const diffInMilliseconds = Math.max(0, Date.now() - timestamp.getTime());

  if (diffInMilliseconds < 60_000) return "New";
  if (diffInMilliseconds < 86_400_000) return "Earlier";

  return "Older";
}

function statusTextClass(status: string | undefined) {
  switch (status) {
    case "passed":
      return "text-emerald-300";
    case "failed":
      return "text-rose-300";
    default:
      return "text-slate-400";
  }
}

export function DashboardNavbar({
  title,
  user,
  notifications,
}: DashboardNavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const email = user.email ?? "";
  const fullName = user.user_metadata.full_name ?? email;
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const unreadNotifications = notifications.filter(({ readAt }) => !readAt);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out!");
    router.push("/login");
  };

  const handleMarkAllRead = () => {
    if (unreadNotifications.length === 0) return;
    startTransition(async () => {
      await markNotificationsAsRead();
      router.refresh();
    });
  };

  const handleMarkOneRead = (notificationId: string) => {
    startTransition(async () => {
      await markNotificationsAsRead([notificationId]);
      router.refresh();
    });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-slate-800/80 bg-slate-950/85 px-4 text-slate-100 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="-ml-1 size-10 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-100" />
      <Separator orientation="vertical" className="mr-1 h-5 bg-slate-800" />
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        <h1 className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-slate-300">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-10 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <Bell />
              <span className="sr-only">Notifications</span>
              {unreadNotifications.length > 0 ? (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 border-slate-700 bg-slate-900 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.5)]"
          >
            <DropdownMenuLabel className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Notifications
                <Badge
                  variant="secondary"
                  className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                >
                  {unreadNotifications.length} new
                </Badge>
              </span>
              {unreadNotifications.length > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="min-h-9 cursor-pointer rounded-md px-2 text-xs font-normal text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                >
                  Mark all as read
                </button>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuGroup className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => {
                  const isUnread = !notification.readAt;
                  const currentGroup = getNotificationGroup(
                    notification.createdAt,
                  );
                  const previousGroup =
                    index > 0
                      ? getNotificationGroup(notifications[index - 1].createdAt)
                      : null;
                  const showLabel =
                    index === 0 || previousGroup !== currentGroup;

                  return (
                    <div key={notification.id}>
                      {showLabel ? (
                        <span className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          {currentGroup}
                        </span>
                      ) : null}
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="flex-col items-start gap-0.5 rounded-lg text-slate-200 focus:bg-slate-800 focus:text-white"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {notification.scanId && notification.scanInfo
                              ? `Scan ${notification.scanInfo.project}`
                              : "General update"}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            {notification.scanId && notification.scanInfo && (
                              <span
                                className={cn(
                                  "text-xs font-medium capitalize",
                                  statusTextClass(notification.scanInfo.status),
                                )}
                              >
                                {notification.scanInfo.status}
                              </span>
                            )}
                            {isUnread ? (
                              <button
                                type="button"
                                title="Mark as read"
                                disabled={isPending}
                                onClick={() =>
                                  handleMarkOneRead(notification.id)
                                }
                                aria-label="Mark notification as read"
                                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors duration-200 hover:bg-slate-700 hover:text-emerald-300 disabled:opacity-50"
                              >
                                <Check className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    </div>
                  );
                })
              ) : (
                <DropdownMenuItem
                  className="flex-col items-start gap-0.5 text-slate-500"
                  disabled
                >
                  <span className="text-sm font-medium">No notifications</span>
                  <span className="text-xs">You are all caught up.</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 cursor-pointer gap-2 px-1.5 text-slate-200 hover:bg-slate-800 hover:text-white md:pr-2.5"
            >
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="rounded-md border border-emerald-400/20 bg-emerald-400/10 text-xs font-medium text-emerald-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start leading-tight md:flex">
                <span className="text-xs font-medium">{fullName}</span>
                <span className="text-[11px] text-slate-500">{email}</span>
              </div>
              <ChevronsUpDown className="hidden text-slate-500 md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 border-slate-700 bg-slate-900 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.5)]"
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{fullName}</span>
              <span className="text-xs font-normal text-slate-500">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-slate-800 focus:text-white"
                onClick={() => router.push("/dashboard/settings")}
              >
                <User />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-slate-800 focus:text-white"
                onClick={() => router.push("/dashboard/settings")}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-rose-300 focus:bg-rose-400/10 focus:text-rose-200"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
