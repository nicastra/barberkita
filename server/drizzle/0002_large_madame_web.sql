CREATE TYPE "public"."schedule_exception_kind" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TABLE "barber_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "barber_breaks_day_range" CHECK ("barber_breaks"."day_of_week" >= 0 and "barber_breaks"."day_of_week" <= 6),
	CONSTRAINT "barber_breaks_time_range" CHECK ("barber_breaks"."start_minute" >= 0 and "barber_breaks"."end_minute" <= 1440 and "barber_breaks"."start_minute" < "barber_breaks"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "barber_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"staff_user_id" uuid,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barber_schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "schedule_exception_kind" NOT NULL,
	"start_minute" smallint,
	"end_minute" smallint,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_schedule_exceptions_time_pair" CHECK (("barber_schedule_exceptions"."start_minute" is null and "barber_schedule_exceptions"."end_minute" is null) or ("barber_schedule_exceptions"."start_minute" >= 0 and "barber_schedule_exceptions"."end_minute" <= 1440 and "barber_schedule_exceptions"."start_minute" < "barber_schedule_exceptions"."end_minute"))
);
--> statement-breakpoint
CREATE TABLE "barber_services" (
	"barber_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "barber_services_barber_id_service_id_pk" PRIMARY KEY("barber_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "barber_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "barber_working_hours_day_range" CHECK ("barber_working_hours"."day_of_week" >= 0 and "barber_working_hours"."day_of_week" <= 6),
	CONSTRAINT "barber_working_hours_time_range" CHECK ("barber_working_hours"."start_minute" >= 0 and "barber_working_hours"."end_minute" <= 1440 and "barber_working_hours"."start_minute" < "barber_working_hours"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_rupiah" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_positive" CHECK ("services"."duration_minutes" > 0),
	CONSTRAINT "services_price_nonnegative" CHECK ("services"."price_rupiah" >= 0)
);
--> statement-breakpoint
ALTER TABLE "barber_breaks" ADD CONSTRAINT "barber_breaks_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD CONSTRAINT "barber_profiles_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD CONSTRAINT "barber_profiles_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_schedule_exceptions" ADD CONSTRAINT "barber_schedule_exceptions_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_working_hours" ADD CONSTRAINT "barber_working_hours_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_breaks_barber_day_idx" ON "barber_breaks" USING btree ("barber_id","day_of_week");--> statement-breakpoint
CREATE INDEX "barber_profiles_shop_id_idx" ON "barber_profiles" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_profiles_staff_user_id_unique" ON "barber_profiles" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "barber_schedule_exceptions_barber_date_idx" ON "barber_schedule_exceptions" USING btree ("barber_id","date");--> statement-breakpoint
CREATE INDEX "barber_services_service_id_idx" ON "barber_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "barber_working_hours_barber_day_idx" ON "barber_working_hours" USING btree ("barber_id","day_of_week");--> statement-breakpoint
CREATE INDEX "services_shop_id_idx" ON "services" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_staff_user_id_idx" ON "sessions" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_users_shop_id_idx" ON "staff_users" USING btree ("shop_id");
