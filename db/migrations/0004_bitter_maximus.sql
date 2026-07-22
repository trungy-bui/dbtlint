CREATE TABLE IF NOT EXISTS "scans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"project" text NOT NULL,
	"scan_id" text NOT NULL,
	"scan_path" text NOT NULL,
	"status" text DEFAULT 'ongoing',
	"score" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "scan_id" text;
--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "scan_path" text;
--> statement-breakpoint
UPDATE "scans"
SET
	"scan_id" = COALESCE("scan_id", "id"::text),
	"scan_path" = COALESCE("scan_path", "project")
WHERE "scan_id" IS NULL OR "scan_path" IS NULL;
--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "scan_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "scan_path" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE connamespace = 'public'::regnamespace
			AND conname = 'scans_user_id_users_id_fk'
	) THEN
		ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_user_id_created_at_idx" ON "scans" USING btree ("user_id","createdAt" DESC NULLS LAST);
