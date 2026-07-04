import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const forwardedUserHeaders = [
  "x-user-id",
  "x-user-email",
  "x-user-metadata",
] as const;

function createForwardedResponse(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function setForwardedUserHeaders(requestHeaders: Headers, user: User) {
  requestHeaders.set("x-user-id", user.id);
  requestHeaders.set("x-user-email", user.email ?? "");
  requestHeaders.set(
    "x-user-metadata",
    encodeURIComponent(JSON.stringify(user.user_metadata ?? {})),
  );
}

function recreateResponseWithForwardedHeaders(
  response: NextResponse,
  requestHeaders: Headers,
) {
  const forwardedResponse = createForwardedResponse(requestHeaders);

  response.cookies.getAll().forEach((cookie) => {
    forwardedResponse.cookies.set(cookie);
  });

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      forwardedResponse.headers.set(key, value);
    }
  });

  return forwardedResponse;
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  forwardedUserHeaders.forEach((header) => {
    requestHeaders.delete(header);
  });

  let supabaseResponse = createForwardedResponse(requestHeaders);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = createForwardedResponse(requestHeaders);

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  let user = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.name !== "AuthSessionMissingError") {
        await supabase.auth.signOut();
      }
    } else {
      user = data.user;
    }
  } catch {
    await supabase.auth.signOut().catch(() => {});
  }

  if (user) {
    setForwardedUserHeaders(requestHeaders, user);
    supabaseResponse = recreateResponseWithForwardedHeaders(
      supabaseResponse,
      requestHeaders,
    );
  }

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/register"))
  ) {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  return supabaseResponse;
}
