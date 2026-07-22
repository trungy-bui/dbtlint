CREATE TABLE "users" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_plan" text DEFAULT 'free',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
