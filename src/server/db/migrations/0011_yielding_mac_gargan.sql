ALTER TABLE "users" ADD COLUMN "dashboard_order_updates" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_delivery_updates" boolean DEFAULT true NOT NULL;