CREATE TYPE "public"."booking_source" AS ENUM('staff', 'public');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('initial', 'confirmed', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_staff_user_id" uuid,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"barber_id" uuid NOT NULL,
	"created_by_staff_user_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'initial' NOT NULL,
	"source" "booking_source" NOT NULL,
	"confirmation_code" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_confirmation_code_unique" UNIQUE("confirmation_code"),
	CONSTRAINT "bookings_time_range" CHECK ("bookings"."start_at" < "bookings"."end_at")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_staff_user_id_staff_users_id_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_staff_user_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_time_excl" EXCLUDE USING gist ("barber_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" IN ('initial', 'confirmed', 'rescheduled'));--> statement-breakpoint
CREATE INDEX "booking_events_booking_id_idx" ON "booking_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_shop_start_idx" ON "bookings" USING btree ("shop_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_id_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_barber_start_idx" ON "bookings" USING btree ("barber_id","start_at");--> statement-breakpoint
CREATE INDEX "customers_shop_name_idx" ON "customers" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_shop_phone_unique" ON "customers" USING btree ("shop_id","phone");
