"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-zinc-900/80 bg-black/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="DBTLint home"
          className="group flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-200 group-hover:bg-white/15">
            <Terminal aria-hidden="true" className="size-4.5 text-white" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-[-0.02em] text-white">
            dbt<span className="text-white">lint</span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-zinc-950 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            className="h-10 cursor-pointer px-3 text-zinc-300 hover:bg-zinc-950 hover:text-white"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            className="h-10 cursor-pointer bg-white px-4 font-semibold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_8px_24px_rgba(0,0,0,0.35)] hover:bg-zinc-100"
          >
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
