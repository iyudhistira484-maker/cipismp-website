DROP INDEX "cart_items_uq";--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "target_name" text;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "is_gift" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_uq" ON "cart_items" USING btree ("cart_id","product_id",coalesce("target_uuid", ''));