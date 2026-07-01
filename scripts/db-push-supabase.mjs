import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("No process.env.DATABASE_URL found");
}

const sql = postgres(databaseUrl, { onnotice: () => {}, ssl: "require" });

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS public.users (
        id uuid PRIMARY KEY NOT NULL,
        email text NOT NULL,
        full_name text,
        avatar_url text,
        stripe_customer_id text,
        stripe_plan text DEFAULT 'free',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS email text,
        ADD COLUMN IF NOT EXISTS full_name text,
        ADD COLUMN IF NOT EXISTS avatar_url text,
        ADD COLUMN IF NOT EXISTS stripe_customer_id text,
        ADD COLUMN IF NOT EXISTS stripe_plan text DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

      ALTER TABLE public.users
        ALTER COLUMN email SET NOT NULL,
        ALTER COLUMN stripe_plan SET DEFAULT 'free',
        ALTER COLUMN created_at SET DEFAULT now(),
        ALTER COLUMN updated_at SET DEFAULT now();

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND conname = 'users_email_unique'
        ) THEN
          ALTER TABLE public.users
            ADD CONSTRAINT users_email_unique UNIQUE (email);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS public.scans (
        id uuid PRIMARY KEY NOT NULL,
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        project text NOT NULL,
        scan_id text NOT NULL,
        scan_path text NOT NULL,
        status text DEFAULT 'ongoing',
        score integer DEFAULT 0 NOT NULL,
        errors integer DEFAULT 0 NOT NULL,
        warnings integer DEFAULT 0 NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      );

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'scans'
            AND column_name = 'date'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'scans'
            AND column_name = 'createdAt'
        ) THEN
          ALTER TABLE public.scans RENAME COLUMN "date" TO "createdAt";
        END IF;
      END $$;

      ALTER TABLE public.scans
        ADD COLUMN IF NOT EXISTS user_id uuid,
        ADD COLUMN IF NOT EXISTS project text,
        ADD COLUMN IF NOT EXISTS scan_id text,
        ADD COLUMN IF NOT EXISTS scan_path text,
        ADD COLUMN IF NOT EXISTS status text DEFAULT 'ongoing',
        ADD COLUMN IF NOT EXISTS score integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS errors integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS warnings integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();

      UPDATE public.scans
      SET
        score = COALESCE(score, 0),
        errors = COALESCE(errors, 0),
        warnings = COALESCE(warnings, 0),
        scan_id = COALESCE(scan_id, id::text),
        scan_path = COALESCE(scan_path, project),
        "createdAt" = COALESCE("createdAt", now());

      ALTER TABLE public.scans
        ALTER COLUMN user_id SET NOT NULL,
        ALTER COLUMN project SET NOT NULL,
        ALTER COLUMN scan_id SET NOT NULL,
        ALTER COLUMN scan_path SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'ongoing',
        ALTER COLUMN score SET DEFAULT 0,
        ALTER COLUMN score SET NOT NULL,
        ALTER COLUMN errors SET DEFAULT 0,
        ALTER COLUMN errors SET NOT NULL,
        ALTER COLUMN warnings SET DEFAULT 0,
        ALTER COLUMN warnings SET NOT NULL,
        ALTER COLUMN "createdAt" SET DEFAULT now(),
        ALTER COLUMN "createdAt" SET NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND conname = 'scans_user_id_users_id_fk'
        ) THEN
          ALTER TABLE public.scans
            ADD CONSTRAINT scans_user_id_users_id_fk
            FOREIGN KEY (user_id)
            REFERENCES public.users(id)
            ON DELETE CASCADE;
        END IF;
      END $$;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'scans'
            AND indexname = 'scans_user_id_date_idx'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'scans'
            AND indexname = 'scans_user_id_created_at_idx'
        ) THEN
          ALTER INDEX public.scans_user_id_date_idx
            RENAME TO scans_user_id_created_at_idx;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS scans_user_id_created_at_idx
        ON public.scans USING btree (user_id, "createdAt" DESC);
    `);
  });

  console.log("Supabase public schema is up to date.");
} finally {
  await sql.end();
}
