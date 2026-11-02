CREATE TYPE "public"."email_delivery_status" AS ENUM('pending', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"giver_id" text NOT NULL,
	"status" "email_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_error_code" text,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_attempts_nonnegative" CHECK ("email_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_giver_id_user_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_group_giver_uq" ON "email_deliveries" USING btree ("group_id","giver_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_group_status_idx" ON "email_deliveries" USING btree ("group_id","status");