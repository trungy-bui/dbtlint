CREATE TABLE "github_pr_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project" text NOT NULL,
	"scan_id" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"report" jsonb DEFAULT 'null'::jsonb,
	"repository_full_name" text NOT NULL,
	"pr_number" integer NOT NULL,
	"head_sha" text NOT NULL,
	"installation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_pr_scans" ADD CONSTRAINT "github_pr_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_pr_scans_scan_id_idx" ON "github_pr_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_pr_scans_repo_pr_head_idx" ON "github_pr_scans" USING btree ("repository_full_name","pr_number","head_sha");--> statement-breakpoint
CREATE INDEX "github_pr_scans_user_id_created_at_idx" ON "github_pr_scans" USING btree ("user_id","created_at" DESC NULLS LAST);