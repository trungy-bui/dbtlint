"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Workflow", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Rule reference", href: "/" },
      { label: "Community", href: "https://discord.gg/GrF9hFjTS2" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Security", href: "/" },
      { label: "Contact", href: "/" },
      { label: "Get started", href: "/register" },
    ],
  },
];

export function Footer() {
  const reduceMotion = useReducedMotion();

  return (
    <footer className="bg-slate-950">
      <section
        className="px-4 py-20 sm:px-6 sm:py-24"
        aria-labelledby="footer-cta-title"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 px-6 py-12 shadow-[0_30px_90px_rgba(2,6,23,0.35)] sm:px-10 sm:py-14 lg:px-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:36px_36px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-emerald-400/10 blur-3xl"
          />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-emerald-400">
                Your next PR can be cleaner
              </p>
              <h2
                id="footer-cta-title"
                className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-50 sm:text-4xl"
              >
                Turn your dbt standards into an automatic quality gate.
              </h2>
              <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-400 sm:text-base">
                Start with one project, see every finding in context, and give
                your team a faster path to review-ready models.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                size="lg"
                className="h-12 cursor-pointer bg-emerald-400 px-6 font-semibold text-slate-950 hover:bg-emerald-300"
              >
                <Link href="/register">
                  Start linting free
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 cursor-pointer text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Link href="/login">Sign in to your workspace</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="border-t border-slate-800/80">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-4 py-12 sm:px-6 md:grid-cols-[1.25fr_2fr] lg:gap-20 lg:py-16">
          <div>
            <Link
              href="/"
              aria-label="DBTLint home"
              className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
                <Terminal
                  aria-hidden="true"
                  className="size-4.5 text-emerald-400"
                />
              </span>
              <span className="font-mono text-sm font-semibold text-slate-50">
                dbt<span className="text-emerald-400">lint</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              Reliable linting and shared standards for teams building with dbt.
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3"
          >
            {footerLinks.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-slate-200">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("/") ? (
                        <Link
                          href={link.href}
                          className="inline-flex min-h-10 cursor-pointer items-center text-sm text-slate-500 transition-colors duration-200 hover:text-slate-200 focus-visible:outline-none focus-visible:text-emerald-300"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="inline-flex min-h-10 cursor-pointer items-center text-sm text-slate-500 transition-colors duration-200 hover:text-slate-200 focus-visible:outline-none focus-visible:text-emerald-300"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 border-t border-slate-800/80 px-4 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} DBTLint. All rights reserved.</p>
          <p className="font-mono">Built for reliable data work.</p>
        </div>
      </div>
    </footer>
  );
}
