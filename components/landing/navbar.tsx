  "use client";

  import { motion, useReducedMotion } from "framer-motion";
  import { Terminal } from "lucide-react";
  import Link from "next/link";
  import { useEffect, useState } from "react";
  import { Button } from "@/components/ui/button";

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Workflow", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ];

  export function Navbar() {
    const reduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    return (
      <motion.header
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: mounted && !reduceMotion ? 0.25 : 0,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            aria-label="DBTLint home"
            className="group flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors duration-200 group-hover:bg-emerald-400/15">
              <Terminal
                aria-hidden="true"
                className="size-4.5 text-emerald-400"
              />
            </span>
            <span className="font-mono text-sm font-semibold tracking-[-0.02em] text-slate-50">
              dbt<span className="text-emerald-400">lint</span>
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
                className="flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-slate-400 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-900 hover:text-slate-100 hover:shadow-[0_0_16px_rgba(148,163,184,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:translate-y-0 active:scale-[0.98] active:bg-slate-950 active:shadow-[0_0_8px_rgba(148,163,184,0.15)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              className="h-10 cursor-pointer px-3 text-slate-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white hover:shadow-[0_0_16px_rgba(148,163,184,0.25)] active:not-aria-[haspopup]:translate-y-0 active:scale-[0.98] active:bg-slate-950 active:shadow-[0_0_8px_rgba(148,163,184,0.15)]"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="h-10 cursor-pointer bg-emerald-400 px-4 font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_8px_24px_rgba(16,185,129,0.16)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] active:not-aria-[haspopup]:translate-y-0 active:scale-[0.98] active:bg-emerald-500 active:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
      </motion.header>
    );
  }
