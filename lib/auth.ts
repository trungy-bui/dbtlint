"use server";

import { createClient } from "@/lib/supabase/server";

export type OAuthProvider = "google" | "github";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.name !== "AuthSessionMissingError") {
      await supabase.auth.signOut();
    }
    return null;
  }

  return user;
}
