"use client";

import { motion, type Variants } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    desc: "For solo analysts and side projects.",
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
    price: "$29",
    period: "/mo",
    desc: "For data teams shipping together.",
    features: [
      "Unlimited dbt projects",
      "CI/CD integration",
      "Shared rule sets",
      "Custom rule packs",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/register?plan=team",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations at scale.",
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

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function Pricing() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-sm text-emerald-400">
            simple pricing
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Plans that scale with your data team
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Start free, upgrade when you need CI and collaboration.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {plans.map((plan) => {
            const href =
              plan.name === "Team" && isLoggedIn
                ? "/api/lemonsqueezy/checkout"
                : plan.href;

            return (
              <motion.div
                key={plan.name}
                variants={item}
                whileHover={{ y: -4 }}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  plan.highlighted
                    ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3 left-7 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-medium text-zinc-950">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-lg font-medium text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.desc}
                </p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="mb-1 text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>

                <ul className="mt-6 flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-zinc-300"
                    >
                      <Check className="size-4 shrink-0 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-8"
                >
                  <Button
                    asChild
                    size="lg"
                    variant={plan.highlighted ? "default" : "outline"}
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                        : ""
                    }`}
                  >
                    <a href={href}>{plan.cta}</a>
                  </Button>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
