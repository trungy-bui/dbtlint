"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const footerLinks = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Integrations", "Changelog"],
  },
  {
    title: "Resources",
    links: ["Rule reference", "Blog", "Community"],
  },
  {
    title: "Company",
    links: ["About", "Contact", "Security"],
  },
];

export function Footer() {
  return (
    <>
      <section className="relative py-24">
        <div className="mx-auto w-full max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-8 py-16 text-center"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative z-10">
              <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ship cleaner dbt models, starting today
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-pretty text-zinc-400">
                Join thousands of data engineers who lint with confidence. Free
                to start, no credit card required.
              </p>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="mt-8 inline-block"
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                >
                  <a href="/register">
                    Get started free
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-14">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <Terminal className="size-4 text-emerald-400" />
                </div>
                <span className="font-mono text-base font-semibold tracking-tight text-foreground">
                  DBT Lint
                </span>
              </a>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                Lint your dbt projects. Ship with confidence.
              </p>
            </div>

            {footerLinks.map((column) => (
              <div key={column.title}>
                <h4 className="text-sm font-medium text-foreground">
                  {column.title}
                </h4>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a
                        href={
                          link === "Community"
                            ? "https://discord.gg/GrF9hFjTS2"
                            : "/"
                        }
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} DBT Lint. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
