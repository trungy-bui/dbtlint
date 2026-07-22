ALTER TABLE "scans" ALTER COLUMN "status" SET DEFAULT 'processing';--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "report" jsonb DEFAULT 'null'::jsonb;