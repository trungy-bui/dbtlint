import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const plan = searchParams.get("plan");
  const error = searchParams.get("error");

  const host =
    request.headers.get("x-forwarded-host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const trueOrigin = `${proto}://${host}`;

  if (error) {
    return NextResponse.redirect(`${trueOrigin}/login`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (plan === "team") {
        return NextResponse.redirect(`${trueOrigin}/api/lemonsqueezy/checkout`);
      }
      return NextResponse.redirect(`${trueOrigin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${trueOrigin}/dashboard`);
}
