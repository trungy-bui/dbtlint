"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out!");
    router.push("/login");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      onClick={handleSignOut}
      className="size-11 cursor-pointer text-slate-400 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <LogOut className="size-4" />
    </Button>
  );
}
