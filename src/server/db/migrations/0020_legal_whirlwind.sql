CREATE TABLE "checkout_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"order_id" text,
	"state" text DEFAULT 'PROCESSING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "checkout_attempts_cart_idx" ON "checkout_attempts" USING btree ("cart_id");