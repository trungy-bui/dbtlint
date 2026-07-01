"use client";

import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="ixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Terminal className="size-4 text-emerald-400" />
          </div>
          <span className="font-mono text-base font-semibold tracking-tight text-foreground">
            DBTLint
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <a href="/login">Sign in</a>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
          >
            <a href="/register">Get started</a>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
