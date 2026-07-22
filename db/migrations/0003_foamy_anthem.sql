ALTER TABLE "users" RENAME COLUMN "uuid" TO "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "password" TO "avatar_url";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now();