CREATE TABLE "payment_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config_encrypted" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "payment_credentials_provider_unique" UNIQUE("provider")
);
