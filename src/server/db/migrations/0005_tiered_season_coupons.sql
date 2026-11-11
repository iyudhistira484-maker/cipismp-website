ALTER TABLE "coupons" ADD COLUMN "tiers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "season_id" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupons_season_idx" ON "coupons" USING btree ("season_id");