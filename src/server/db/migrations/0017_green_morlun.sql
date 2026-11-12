CREATE TABLE "staff_minecraft_accounts" (
	"uuid" text PRIMARY KEY NOT NULL,
	"staff_user_id" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_minecraft_accounts" ADD CONSTRAINT "staff_minecraft_accounts_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_minecraft_accounts_user_idx" ON "staff_minecraft_accounts" USING btree ("staff_user_id");