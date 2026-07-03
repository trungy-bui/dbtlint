# DBTLint

DBTLint is a SaaS application for linting dbt projects. Users upload a ZIP archive of a dbt project, the backend runs `sqlfluff` against SQL files in `models`, `tests`, and `macros`, and the app stores a score, issue counts, and file-level recommendations for review.

## Features

- Landing page with feature, workflow, and pricing sections.
- Supabase authentication with email/password, GitHub OAuth, and Google OAuth.
- Dashboard with total projects, total scans, errors found, warnings found, trends, recent scans, and quick upload.
- ZIP upload flow backed by Supabase Storage and `/api/lint`.
- Trigger.dev background linting with realtime run progress in the upload UI.
- Per-project scan history and scan detail pages with score, status, error/warning counts, file-level violations, and generated recommendations.
- Lemon Squeezy subscription checkout and webhook handling for the Team plan.
- Pricing surface for Free, Team, and Enterprise tiers. The current persisted plan model supports `free` and `team`; Enterprise is presented as a contact-sales tier.
- Upload rate limiting with Upstash Redis and a Free-plan project limit.
- Sentry error monitoring and PostHog client analytics.

## Tech Stack

- Next.js 16 App Router with React 19 and TypeScript.
- Tailwind CSS 4, Radix UI primitives, lucide-react icons, Framer Motion, and Sonner.
- Supabase Auth and Supabase Storage.
- PostgreSQL with Drizzle ORM and Drizzle Kit migrations.
- Trigger.dev v4 tasks and React realtime hooks.
- `sqlfluff` 4.2.2 for dbt SQL linting, installed through `requirement.txt`.
- Upstash Redis and `@upstash/ratelimit` for upload rate limiting.
- Lemon Squeezy for subscription checkout and billing webhooks.
- Sentry for error monitoring.
- PostHog for client-side analytics.
- Biome for linting and formatting.

## Architecture Overview

1. A signed-in user selects one or more `.zip` dbt project archives in the upload UI.
2. The browser uploads each archive to the Supabase Storage bucket `dbt-uploads`.
3. The client calls `POST /api/lint` with the uploaded file name and storage path.
4. The API route authenticates the user, applies the Upstash upload rate limit, enforces the Free-plan project limit, creates a `scans` row with `processing` status, and triggers the `dbt-lint` Trigger.dev task.
5. `trigger/dbtLintTask.ts` downloads the archive from Supabase Storage, validates ZIP size and structure limits, extracts it to a temporary directory, and searches for SQL files under `models`, `tests`, and `macros`.
6. The task runs `sqlfluff lint --format json` for each SQL file with bounded concurrency and records Trigger.dev metadata progress while it runs.
7. Results are normalized into category reports, totals, and a 0-100 score, then written back to the `scans` table as `passed` or `failed`.
8. Dashboard and project pages read scan data from Postgres through Drizzle. The scan detail panel derives recommendations from the most frequent sqlfluff violation codes and descriptions.

## Getting Started

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd dbtlint
npm install
```

Create `.env.local` with the environment variables used by the app:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Drizzle and the app. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for browser/server auth clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key used by background tasks and server-side storage access. |
| `NEXT_PUBLIC_SITE_URL` | Base site URL used for auth and billing redirects. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL used by `Redis.fromEnv()`. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token used by `Redis.fromEnv()`. |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy API key for checkout creation. |
| `LEMONSQUEEZY_STORE_ID` | Lemon Squeezy store ID. |
| `NEXT_PUBLIC_LEMONSQUEEZY_TEAM_VARIANT_ID` | Lemon Squeezy variant ID for the Team plan checkout. |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Secret used to verify Lemon Squeezy webhook signatures. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional PostHog project key for client analytics. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog host URL for client analytics. |
| `DBT_LINT_MAX_TOTAL_UNCOMPRESSED_BYTES` | Optional maximum total uncompressed ZIP size for lint tasks. |
| `DBT_LINT_SQLFLUFF_CONCURRENCY` | Optional sqlfluff per-task concurrency override. |
| `DBT_LINT_TASK_QUEUE_CONCURRENCY` | Optional Trigger.dev queue concurrency override for lint tasks. |

You will also need:

- A Supabase Storage bucket named `dbt-uploads`.
- A PostgreSQL database reachable through `DATABASE_URL`.
- Trigger.dev credentials configured for local development.
- Python available for the Trigger.dev Python extension. `requirement.txt` pins `sqlfluff==4.2.2`.

Run database migrations or push the schema:

```bash
npm run db:migrate
# or
npm run db:push
```

Start the local app and Trigger.dev dev worker:

```bash
npm run dev
```

`npm run dev` starts `next dev` and `npm run trigger:dev` together with `concurrently`.

## Available Scripts

| Script | Command |
| --- | --- |
| `npm run dev` | `npx concurrently --kill-others --names "next,trigger" --prefix-colors "yellow,blue" "next dev" "npm run trigger:dev"` |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `biome check` |
| `npm run trigger:dev` | `npx trigger.dev@4.5.0 dev` |
| `npm run format` | `biome format --write` |
| `npm run db:generate` | `drizzle-kit generate` |
| `npm run db:migrate` | `drizzle-kit migrate` |
| `npm run db:push` | `node scripts/db-push-supabase.mjs` |
| `npm run db:push:drizzle` | `drizzle-kit push` |
| `npm run db:studio` | `drizzle-kit studio` |

## Project Structure

```text
app/
  App Router pages and route handlers, including auth, dashboard, upload, project detail, lint API, and Lemon Squeezy APIs.
components/
  UI, landing, auth, dashboard, upload, and project report components.
db/
  Drizzle database client, schema, migrations, and Supabase auth SQL.
lib/
  Shared server/client utilities for auth, dashboard queries, Supabase clients, plan limits, Lemon Squeezy, validation, and time formatting.
trigger/
  Trigger.dev background tasks, including the dbt linting task.
actions/
  Server action modules.
hooks/
  Shared React hooks.
scripts/
  Database utility scripts.
public/
  Static assets served by Next.js.
```
