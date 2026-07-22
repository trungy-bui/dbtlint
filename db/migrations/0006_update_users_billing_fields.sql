ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lemonsqueezy_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lemonsqueezy_subscription_id" text;--> statement-breakpoint
UPDATE "users"
SET "plan" = CASE
  WHEN "stripe_plan" IN ('free', 'team') THEN "stripe_plan"
  ELSE 'free'
END;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_check" CHECK ("users"."plan" in ('free', 'team'));--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_plan";
