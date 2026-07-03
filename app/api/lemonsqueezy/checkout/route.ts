import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import db from "@/db";
import { users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { configureLemonSqueezy } from "@/lib/lemon-squeezy/client";

export async function GET() {
  const user = await getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL),
    );
  }

  try {
    const [currentUser] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (currentUser?.plan === "team") {
      return NextResponse.redirect(
        new URL(
          "/dashboard?already_subscribed=1",
          process.env.NEXT_PUBLIC_SITE_URL,
        ),
      );
    }
  } catch (error) {
    console.error("Failed to check user plan before checkout", {
      error,
      userId: user.id,
    });
    return NextResponse.redirect(
      new URL("/dashboard?checkout_error=1", process.env.NEXT_PUBLIC_SITE_URL),
    );
  }

  const checkoutData = {
    email: user.email,
    custom: {
      user_id: user.id,
    },
  };

  configureLemonSqueezy();
  const { data, error } = await createCheckout(
    process.env.LEMONSQUEEZY_STORE_ID as string,
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_TEAM_VARIANT_ID as string,
    {
      checkoutData,
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      },
    },
  );

  if (error || !data) {
    return NextResponse.redirect(
      new URL("/dashboard?checkout_error=1", process.env.NEXT_PUBLIC_SITE_URL),
    );
  }

  const checkoutUrl = data.data.attributes.url;

  if (checkoutUrl) {
    return NextResponse.redirect(checkoutUrl);
  } else {
    return NextResponse.redirect(
      new URL("/dashboard?checkout_error=1", process.env.NEXT_PUBLIC_SITE_URL),
    );
  }
}
