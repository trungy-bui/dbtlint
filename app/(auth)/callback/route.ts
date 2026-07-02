import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan");
  const error = searchParams.get("error");

  const requestHeaders = new Headers(request.headers);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (plan === "team") {
        return NextResponse.redirect(`${baseUrl}/api/lemonsqueezy/checkout`);
      }
      return NextResponse.redirect(`${baseUrl}/dashboard`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/dashboard`);
}
