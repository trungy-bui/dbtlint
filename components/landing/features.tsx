'use client'

import { motion, type Variants } from "framer-motion";
import {
  Zap,
  Code2,
  GitBranch,
  Users,
  ShieldCheck,
  Gauge,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Instant dbt project linting',
    desc: 'Scan your entire dbt project in seconds. Get actionable feedback on models, sources, and tests before they hit production.',
  },
  {
    icon: Code2,
    title: 'SQL style checks',
    desc: 'Enforce consistent formatting, naming conventions, and indentation across every model with configurable rules.',
  },
  {
    icon: GitBranch,
    title: 'CI/CD integration',
    desc: 'Drop into GitHub Actions, GitLab CI, or any pipeline. Block merges that break your style guide automatically.',
  },
  {
    icon: Users,
    title: 'Team collaboration',
    desc: 'Share rule sets across your org. Keep every analytics engineer aligned on the same standards.',
  },
  {
    icon: ShieldCheck,
    title: 'Custom rule packs',
    desc: 'Author your own rules or extend community presets. Tailor linting to match your warehouse and conventions.',
  },
  {
    icon: Gauge,
    title: 'Performance insights',
    desc: 'Surface expensive models and anti-patterns early so your warehouse bill stays predictable.',
  },
]

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-sm text-emerald-400">
            everything you need
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Quality checks built for the modern data stack
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            DBT Lint plugs into your workflow and keeps your transformations
            clean, consistent, and review-ready.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              whileHover={{ y: -4 }}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.04]"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 transition-colors group-hover:bg-emerald-500/15">
                <feature.icon className="size-5 text-emerald-400" />
              </div>
              <h3 className="mt-5 text-lg font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
