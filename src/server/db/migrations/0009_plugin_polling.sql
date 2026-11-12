-- Metadata heartbeat and delivery lease token for the companion plugin's outbound HTTPS polling.
ALTER TABLE "servers" ADD COLUMN "plugin_last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "plugin_version" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "lease_token" text;
