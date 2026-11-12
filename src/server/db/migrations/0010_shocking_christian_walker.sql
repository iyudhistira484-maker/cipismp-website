CREATE TABLE "automatic_discounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "coupon_type" NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal_idr" integer DEFAULT 0 NOT NULL,
	"season_id" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"rank_only" boolean DEFAULT false NOT NULL,
	"kit_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_label" text;--> statement-breakpoint
ALTER TABLE "automatic_discounts" ADD CONSTRAINT "automatic_discounts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automatic_discounts_active_idx" ON "automatic_discounts" USING btree ("active");--> statement-breakpoint
CREATE INDEX "automatic_discounts_season_idx" ON "automatic_discounts" USING btree ("season_id");
--> statement-breakpoint
-- Update only the existing, unmodified Season 1; leave its start, status and all other seasons intact.
UPDATE "seasons" SET "end_at" = '2027-01-14 00:00:00+07', "updated_at" = now()
WHERE "slug" = 'season-1' AND "status" = 'ACTIVE'
  AND "end_at" >= '2027-02-09 00:00:00+07' AND "end_at" < '2027-02-10 00:00:00+07';
