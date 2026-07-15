"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Plan = "free" | "team";

type UserPlanResponse = {
  plan: Plan | null;
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individual analytics engineers building better habits.",
    features: [
      "1 dbt project",
      "Core SQL style checks",
      "Local CLI linting",
      "Community rule packs",
    ],
    cta: "Start for free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$19",
    period: "per month",
    description: "For data teams that want one standard across every project.",
    features: [
      "Unlimited dbt projects",
      "CI/CD integration",
      "Shared rule sets",
      "Custom rule packs",
      "Priority support",
    ],
    cta: "Start team trial",
    href: "/register?plan=team",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "built around your org",
    description: "For governed data platforms with security requirements.",
    features: [
      "SSO & SAML",
      "Audit logs",
      "Dedicated support",
      "On-prem deployment",
      "SLA guarantees",
    ],
    cta: "Contact sales",
    href: "#",
    highlighted: false,
  },
];

async function fetchUserPlan(): Promise<Plan | null> {
  try {
    const response = await fetch("/api/user/plan");
    if (!response.ok) return null;
    const data = (await response.json()) as UserPlanResponse;
    return data.plan;
  } catch (error) {
    console.error("fetchUserPlan: network request failed", error);
    return null;
  }
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
  },
};

export function Pricing() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let planRequestId = 0;

    async function updatePlan(sessionExists: boolean) {
      const requestId = ++planRequestId;
      if (!isMounted) return;
      setIsLoggedIn(sessionExists);

      if (!sessionExists) {
        setCurrentPlan(null);
        setIsPlanLoading(false);
        return;
      }

      setIsPlanLoading(true);
      const plan = await fetchUserPlan();
      if (!isMounted || requestId !== planRequestId) return;
      setCurrentPlan(plan);
      setIsPlanLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void updatePlan(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void updatePlan(Boolean(session));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-y border-slate-800/80 bg-slate-900/35 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{
            duration: mounted && !reduceMotion ? 0.35 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
            Clear pricing, clean code
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl lg:text-5xl">
            Start small. Standardize when your team is ready.
          </h2>
          <p className="mt-5 text-pretty text-base leading-7 text-slate-400">
            Every plan includes the core linting experience. Upgrade for shared
            governance and CI automation.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: "-70px" }}
          transition={
            mounted && !reduceMotion
              ? { staggerChildren: 0.07 }
              : { duration: 0, staggerChildren: 0 }
          }
          className="mt-12 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3"
        >
          {plans.map((plan) => {
            const isTeamPlan = plan.name === "Team";
            const isCurrentTeamPlan = isTeamPlan && currentPlan === "team";
            const isTeamPlanLoading =
              isTeamPlan && (isLoggedIn === null || isPlanLoading);
            const href =
              isTeamPlan && isLoggedIn
                ? "/api/lemonsqueezy/checkout"
                : plan.href;
            const cta = isCurrentTeamPlan
              ? "Current plan"
              : isTeamPlanLoading
                ? "Checking plan…"
                : plan.cta;
            const isDisabledCta = isCurrentTeamPlan || isTeamPlanLoading;

            return (
              <motion.article
                key={plan.name}
                variants={item}
                className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
                  plan.highlighted
                    ? "border-emerald-400/40 bg-slate-900 shadow-[0_20px_60px_rgba(2,6,23,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-slate-800 bg-slate-950/65"
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute right-5 top-5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-300">
                    Recommended
                  </span>
                ) : null}

                <div className="pr-24">
                  <h3 className="text-base font-semibold text-slate-100">
                    {plan.name}
                  </h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-7 border-b border-slate-800 pb-7">
                  <span
                    className={`font-mono font-semibold tracking-[-0.04em] text-slate-50 ${plan.price === "Custom" ? "text-3xl" : "text-5xl"}`}
                  >
                    {plan.price}
                  </span>
                  <p className="mt-2 text-xs text-slate-500">{plan.period}</p>
                </div>

                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-slate-300"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-emerald-400"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  {isDisabledCta ? (
                    <Button
                      disabled
                      className="h-11 w-full border border-slate-700 bg-slate-800 text-slate-400"
                    >
                      {cta}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant={plan.highlighted ? "default" : "outline"}
                      className={`h-11 w-full cursor-pointer font-semibold ${plan.highlighted ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white"}`}
                    >
                      {href.startsWith("/") ? (
                        <Link href={href}>{cta}</Link>
                      ) : (
                        <a href={href}>{cta}</a>
                      )}
                    </Button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <Minus aria-hidden="true" className="size-3.5" />
          Plans are billed monthly. Cancel or change tiers at any time.
          <Minus aria-hidden="true" className="size-3.5" />
        </div>
      </div>
    </section>
  );
}
