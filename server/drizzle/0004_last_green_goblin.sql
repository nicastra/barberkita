ALTER TYPE "public"."booking_source" ADD VALUE 'walk_in';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'checked_in' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'in_service' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'completed' AFTER 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'no_show' AFTER 'completed';--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_barber_time_excl";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_time_excl" EXCLUDE USING gist ("barber_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" < 'cancelled');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_at" timestamp with time zone;
