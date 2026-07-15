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
                className="flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-900 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              asChild
              variant="ghost"
              className="h-10 cursor-pointer px-3 text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="h-10 cursor-pointer bg-emerald-400 px-4 font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_8px_24px_rgba(16,185,129,0.16)] hover:bg-emerald-300"
            >
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
      </motion.header>
    );
  }
