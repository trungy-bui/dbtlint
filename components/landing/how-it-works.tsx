'use client'

import { motion, type Variants } from "framer-motion";

const steps = [
  {
    step: '01',
    title: 'Connect your repo',
    desc: 'Link your dbt project from GitHub, GitLab, or Bitbucket in one click. No config required to get started.',
    code: '$ dbt-lint init',
  },
  {
    step: '02',
    title: 'Configure your rules',
    desc: 'Pick a preset or define your own style guide. Toggle rules for naming, formatting, and structure.',
    code: '$ dbt-lint rules --preset strict',
  },
  {
    step: '03',
    title: 'Lint on every commit',
    desc: 'DBT Lint runs in CI and flags issues right in your pull requests, so problems never reach production.',
    code: '$ dbt-lint run --ci',
  },
]

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-transparent"
      />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="font-mono text-sm text-emerald-400">
            up and running fast
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From zero to clean models in three steps
          </h2>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {steps.map((step) => (
            <motion.div
              key={step.step}
              variants={item}
              className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-7"
            >
              <span className="font-mono text-4xl font-semibold text-emerald-500/30">
                {step.step}
              </span>
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
              <div className="mt-5 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2">
                <code className="font-mono text-xs text-emerald-300">
                  {step.code}
                </code>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
