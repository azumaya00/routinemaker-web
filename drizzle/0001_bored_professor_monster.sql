DELETE FROM "rate_limits";--> statement-breakpoint
DROP INDEX "rate_limits_key_created_at_index";--> statement-breakpoint
ALTER TABLE "rate_limits" ADD COLUMN "window_start" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD COLUMN "count" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_key_window_start_unique" ON "rate_limits" USING btree ("key","window_start");--> statement-breakpoint
ALTER TABLE "rate_limits" DROP COLUMN "created_at";
