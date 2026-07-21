# DBTLint

DBTLint is a web application for uploading a dbt project as a ZIP archive, running SQLFluff against its SQL files, and reviewing the resulting project-health report.

## What it does

An authenticated user uploads one or more dbt project ZIPs to Supabase Storage. The application creates a scan record and dispatches a Trigger.dev task that validates and extracts each archive, finds SQL files under `models`, `tests`, and `macros`, and runs SQLFluff with the Jinja templater and Snowflake dialect. The completed report is stored in PostgreSQL and displayed in the dashboard with issue details, recommendations, score history, and CSV export.

## Features

- Email/password registration and login through Supabase Auth, plus GitHub and Google OAuth.
- Drag-and-drop, multi-ZIP upload with per-project and per-scan plan checks.
- Background scanning through Trigger.dev with realtime progress, Supabase scan updates, and database polling as a fallback.
- SQLFluff 4.2.2 linting for `.sql` files found recursively inside the first discovered `models`, `tests`, and `macros` directories.
- Reports containing file and line totals, file-level violations, source lines, SQLFluff rule codes, error and warning counts, and a score from 0 to 100.
- Plain-language violation explanations and recommendations grouped as broken queries, data risks, performance, readability, or formatting issues.
- Dashboard totals, recent scans, latest scan per project, and weekly score history.
- CSV export from the scan detail page.
- In-app scan-completion notifications through PostgreSQL and Supabase Realtime.
- Optional scan-completion email through Resend and scan alerts through Discord webhooks.
- Free and Team plan enforcement, with Lemon Squeezy checkout, customer portal, cancellation, and signed subscription webhooks.
- Upload rate limiting with Upstash Redis.
- Sentry error reporting and optional PostHog analytics.

The current web upload path always uses the SQLFluff `snowflake` dialect. The Trigger.dev task schema accepts a dialect string when invoked directly, but the UI and `POST /api/lint` do not expose a dialect selector.

## Tech stack

| Area | Implementation |
| --- | --- |
| Web application | Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5 |
| Styling and UI | Tailwind CSS 4, Radix UI primitives, Lucide React, Framer Motion, Sonner |
| Charts | Recharts |
| Authentication and storage | Supabase Auth, Supabase SSR, Supabase Storage, Supabase Realtime |
| Database | PostgreSQL with Drizzle ORM and Drizzle Kit |
| Background jobs | Trigger.dev 4.5.3 |
| SQL linting | Python and SQLFluff 4.2.2 with the Jinja templater |
| Billing | Lemon Squeezy |
| Email | Resend and React Email |
| Rate limiting | Upstash Redis and `@upstash/ratelimit` |
| Observability | Sentry and PostHog |
| Validation and forms | Zod, React Hook Form, and `@hookform/resolvers` |
| Code quality | Biome 2.2.0 |

Stripe packages remain in `package.json`, but the active billing routes and database fields use Lemon Squeezy.

## Getting started

### Prerequisites

- Node.js 20.9 or newer. The deployed Trigger.dev worker is configured for Node.js 22.
- npm.
- Python 3 with `pip`; the lint worker invokes Python as `python -m sqlfluff`.
- A Supabase project providing PostgreSQL, Auth, Storage, and Realtime.
- A Trigger.dev project.
- An Upstash Redis database for the upload endpoint.
- Lemon Squeezy and Resend accounts only if you need billing and email locally.

### Install dependencies

```bash
git clone https://github.com/trungy-bui/dbtlint.git
cd dbtlint
npm install
python -m pip install -r requirement.txt
```

`requirement.txt` pins `sqlfluff==4.2.2`. Trigger.dev also installs this file in deployed workers through the Python build extension in `trigger.config.ts`.

### Environment variables

Create `.env.local`. The checked-in `.env.local.example` is incomplete and contains `NEXT_PUBLIC_APP_URL`, which the current code does not read.

Core application variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the Next.js app, Drizzle, scripts, and Trigger.dev tasks. |
| `NEXT_PUBLIC_SITE_URL` | Application origin used for billing redirects, scan links, badge URLs, and the completion callback. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by browser, server, middleware, and task clients. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used for Auth, browser Storage uploads, and Realtime. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key used by the lint and cleanup tasks to download and remove uploaded ZIPs. |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL read by `Redis.fromEnv()` for upload rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST token read by `Redis.fromEnv()` for upload rate limiting. |
| `TRIGGER_SECRET_KEY` | Trigger.dev environment credential used by the SDK and local development CLI. |

Email and notification variables:

| Variable | Purpose |
| --- | --- |
| `SCAN_COMPLETE_WEBHOOK_SECRET` | Shared bearer secret protecting the scan-completion email callback. |
| `RESEND_API_KEY` | Resend API credential. |
| `RESEND_FROM_EMAIL` | Verified sender used for scan-completion email. |
| `DISCORD_WEBHOOK_URL` | Optional Discord webhook for scan result alerts. If absent, scan alerts are skipped. |

Billing variables:

| Variable | Purpose |
| --- | --- |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy API credential. |
| `LEMONSQUEEZY_STORE_ID` | Store used when creating Team checkouts. |
| `NEXT_PUBLIC_LEMONSQUEEZY_TEAM_VARIANT_ID` | Team product variant passed by the checkout route. |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Secret used to verify the `x-signature` webhook header. |
| `DISCORD_REVENUE_WEBHOOK_URL` | Optional Discord webhook for subscription and payment alerts. |
| `REVENUE_BADGE_SECRET` | HMAC secret used to sign the revenue badge URL included in billing alerts. |

Optional runtime and worker variables:

| Variable | Default or purpose |
| --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | Enables PostHog when set with `NEXT_PUBLIC_POSTHOG_HOST`. |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog API host. |
| `SENTRY_AUTH_TOKEN` | Optional Sentry build-plugin credential for source-map uploads. Runtime DSNs are configured in the Sentry source files. |
| `PYTHON_EXECUTABLE` | Preferred local Python interpreter. The task otherwise tries `PYTHON_BIN_PATH`, `python`, `python3`, and Windows `py -3`. |
| `PYTHON_BIN_PATH` | Python interpreter path provided by the Trigger.dev Python extension. |
| `DBT_LINT_MAX_TOTAL_UNCOMPRESSED_BYTES` | Declared uncompressed ZIP limit; defaults to 314,572,800 bytes. |
| `DBT_LINT_SQLFLUFF_BATCH_SIZE` | Files passed to each SQLFluff subprocess; defaults to 40. |
| `DBT_LINT_SQLFLUFF_CONCURRENCY` | Concurrent SQLFluff batches within one task; defaults to 1. |
| `DBT_LINT_TASK_QUEUE_CONCURRENCY` | Concurrent `dbt-lint` task runs; defaults to 4. |

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `TRIGGER_SECRET_KEY`, webhook secrets, or provider API keys to browser code.

### Prepare Supabase and PostgreSQL

1. Create a private Supabase Storage bucket named `dbt-uploads`.
2. Add a Storage policy that lets an authenticated user upload only below that user's `<user-id>/` prefix. The browser writes files as `<user-id>/<timestamp>-<sanitized-name>.zip`.
3. Apply the current Drizzle schema:

   ```bash
   npm run db:push:drizzle
   ```

4. Review `db/supabase-auth.sql` and apply the relevant Auth user-sync trigger and RLS statements in the Supabase SQL editor. Do not run it blindly: its scan index still references a legacy `date` column while the current schema uses `createdAt`.
5. Enable Supabase Realtime for `public.scans` and `public.notifications`. Add SELECT policies that restrict rows to `user_id = auth.uid()`; realtime subscriptions depend on those policies.
6. Enable the desired Supabase Auth providers. GitHub and Google OAuth must redirect back to `/callback` on the local or deployed origin.

The custom `npm run db:push` script is a compatibility/bootstrap script and does not create every field in the current Drizzle schema or the `notifications` table. Use reviewed migrations for shared environments or `npm run db:push:drizzle` for a local schema.

### Run locally

```bash
npm run dev
```

This starts `next dev` and `npm run trigger:dev` together. The latter runs `npx trigger.dev@4.5.3 dev`, so the background worker does not need a second terminal. The application is available at `http://localhost:3000` unless Next.js selects another port.

To run only the Trigger.dev worker:

```bash
npm run trigger:dev
```

### Available scripts

| Script | Actual command | Purpose |
| --- | --- | --- |
| `npm run dev` | `npx concurrently ... "next dev" "npm run trigger:dev"` | Run the web app and Trigger.dev worker together. |
| `npm run build` | `next build` | Create a production Next.js build. |
| `npm run start` | `next start` | Serve a production build. |
| `npm run lint` | `biome check` | Run Biome checks. |
| `npm run format` | `biome format --write` | Format supported files. |
| `npm run trigger:dev` | `npx trigger.dev@4.5.3 dev` | Run Trigger.dev locally. |
| `npm run db:generate` | `drizzle-kit generate` | Generate database migrations from `db/schema.ts`. |
| `npm run db:migrate` | `drizzle-kit migrate` | Apply generated migrations. |
| `npm run db:push` | `node scripts/db-push-supabase.mjs` | Run the legacy-compatible Supabase schema bootstrap script. |
| `npm run db:push:drizzle` | `drizzle-kit push` | Push the current Drizzle schema directly. |
| `npm run db:studio` | `drizzle-kit studio` | Open Drizzle Studio. |

There is currently no dedicated `test` or `typecheck` script in `package.json`.

## Project structure

```text
app/
  Next.js App Router pages and route handlers for landing, authentication,
  dashboard, uploads, scans, user plans, badges, and Lemon Squeezy.
components/
  Authentication, landing, dashboard, upload, report, and reusable UI code.
db/
  Drizzle schema and database client, plus Supabase Auth/RLS setup SQL.
design-system/
  DBTLint visual design notes and page specifications.
emails/
  React Email templates for scan and billing messages.
hooks/
  Shared React hooks.
lib/
  Auth, Supabase clients, dashboard queries, reports, plan limits, billing,
  notifications, validation, email, Discord, and shared utilities.
public/
  Static images and icons used by the application and README.
scripts/
  Database bootstrap utilities.
trigger/
  The Trigger.dev lint pipeline, completion-email dispatcher, and uploaded-ZIP
  cleanup task.
```

The `rules`, `profile`, and `settings` routes currently render placeholders and are not implemented product features.

## Linting behavior and limits

The worker recursively searches the extracted archive for the first directory named `models`, `tests`, and `macros`, then recursively lints lowercase `.sql` files inside those directories. A missing category is marked as skipped. A scan fails if there are no SQL files.

Uploaded `.sqlfluff`, `pyproject.toml`, `tox.ini`, `setup.cfg`, `dbt_project.yml`, and `profiles.yml` files are renamed before linting. The worker uses a locked Jinja configuration and passes `--dialect snowflake` for scans created through the web API, so project-controlled SQLFluff and dbt configuration does not affect a scan.

SQLFluff violations whose codes begin with `PRS` or `TMP` count as errors; all other violations count as warnings. A scan passes only when the error count is zero. The score is:

```text
round(100 - (errors / files * 15 + warnings / files * 3))
```

The result is clamped to the range 0–100.

| Constraint | Current value |
| --- | ---: |
| Upload requests | 5 per user per sliding minute |
| Free plan projects | 1 distinct project |
| Free plan scans | 5 per calendar month |
| Uploaded ZIP size | 50 MiB |
| ZIP entries | 10,000 |
| Declared uncompressed ZIP content | 300 MiB by default |
| Extracted project files, including non-SQL files | 5,000 |
| SQL files | 1,000 |
| Total SQL lines | 200,000 |
| Directory nesting | 20 levels |
| SQLFluff output buffer | 10 MiB per subprocess |
| SQLFluff batch size | 40 files by default |
| SQLFluff batch concurrency | 1 per task by default |
| SQLFluff timeout | 60 seconds per batch |
| Concurrent lint tasks | 4 by default |
| Trigger.dev machine | `small-2x` |
| Trigger.dev task maximum duration | 3,600 seconds |

ZIP paths are checked before extraction, symbolic links are skipped during traversal, temporary files are removed in the task's `finally` block, and the uploaded archive is dispatched to a retrying cleanup task after every run.

## Contributing

This repository is public, includes an MIT license, and has no separate `CONTRIBUTING.md`. Before proposing a change, run the checks that are currently defined:

```bash
npm run lint
npm run build
```

Keep database changes in `db/schema.ts`, review generated migrations before applying them, and never commit `.env.local` or service credentials.

## License

DBTLint is licensed under the [MIT License](LICENSE), copyright © 2026 Lil Baby.
