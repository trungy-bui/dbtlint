import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const plan = searchParams.get("plan");
  const error = searchParams.get("error");

  const host = request.headers.get("x-forwarded-host") || requestUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    requestUrl.protocol.replace(":", "");
  const trueOrigin = `${proto}://${host}`;

  const redirectWithPlan = (pathname: string) => {
    const redirectUrl = new URL(pathname, trueOrigin);

    if (plan) {
      redirectUrl.searchParams.set("plan", plan);
    }

    return NextResponse.redirect(redirectUrl);
  };

  if (error) {
    return redirectWithPlan("/login");
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (plan === "team") {
        return NextResponse.redirect(
          new URL("/api/lemonsqueezy/checkout", trueOrigin),
        );
      }
      return NextResponse.redirect(new URL("/dashboard", trueOrigin));
    }
  }

  return redirectWithPlan("/login");
}
