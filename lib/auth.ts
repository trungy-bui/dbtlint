"use server";

import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type OAuthProvider = "google" | "github";

function parseForwardedUserMetadata(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    const metadata = JSON.parse(decodeURIComponent(value));
    return metadata && typeof metadata === "object" ? metadata : {};
  } catch {
    try {
      const metadata = JSON.parse(value);
      return metadata && typeof metadata === "object" ? metadata : {};
    } catch {
      return {};
    }
  }
}

export async function getUser() {
  const headerStore = await headers();
  const forwardedUserId = headerStore.get("x-user-id");

  if (forwardedUserId) {
    return {
      id: forwardedUserId,
      email: headerStore.get("x-user-email") || undefined,
      user_metadata: parseForwardedUserMetadata(
        headerStore.get("x-user-metadata"),
      ),
    } as User;
  }

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
