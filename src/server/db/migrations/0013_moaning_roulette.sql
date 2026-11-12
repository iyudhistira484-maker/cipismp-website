CREATE TABLE "minecraft_live_snapshots" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"primary_group" text,
	"kits" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "minecraft_live_snapshots" ADD CONSTRAINT "minecraft_live_snapshots_profile_id_minecraft_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."minecraft_profiles"("id") ON DELETE cascade ON UPDATE no action;