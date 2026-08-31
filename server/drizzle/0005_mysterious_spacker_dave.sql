CREATE TYPE "public"."checkout_status" AS ENUM('unpaid', 'partially_paid', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_correction_kind" AS ENUM('refund', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'qris');--> statement-breakpoint
CREATE TABLE "checkout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_id" uuid NOT NULL,
	"service_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_rupiah" integer NOT NULL,
	"line_total_rupiah" integer NOT NULL,
	CONSTRAINT "checkout_items_quantity_positive" CHECK ("checkout_items"."quantity" > 0),
	CONSTRAINT "checkout_items_unit_price_nonnegative" CHECK ("checkout_items"."unit_price_rupiah" >= 0),
	CONSTRAINT "checkout_items_line_total_nonnegative" CHECK ("checkout_items"."line_total_rupiah" >= 0),
	CONSTRAINT "checkout_items_total_consistent" CHECK ("checkout_items"."line_total_rupiah" = "checkout_items"."quantity" * "checkout_items"."unit_price_rupiah")
);
--> statement-breakpoint
CREATE TABLE "checkout_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_id" uuid NOT NULL,
	"amount_rupiah" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"recorded_by_staff_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_payments_amount_positive" CHECK ("checkout_payments"."amount_rupiah" > 0)
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"barber_id" uuid NOT NULL,
	"created_by_staff_user_id" uuid,
	"receipt_number" text NOT NULL,
	"subtotal_rupiah" integer NOT NULL,
	"discount_rupiah" integer DEFAULT 0 NOT NULL,
	"total_rupiah" integer NOT NULL,
	"adjustment_reason" text DEFAULT '' NOT NULL,
	"status" "checkout_status" DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkouts_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "checkouts_subtotal_nonnegative" CHECK ("checkouts"."subtotal_rupiah" >= 0),
	CONSTRAINT "checkouts_discount_nonnegative" CHECK ("checkouts"."discount_rupiah" >= 0),
	CONSTRAINT "checkouts_total_nonnegative" CHECK ("checkouts"."total_rupiah" >= 0),
	CONSTRAINT "checkouts_totals_consistent" CHECK ("checkouts"."total_rupiah" = "checkouts"."subtotal_rupiah" - "checkouts"."discount_rupiah" and "checkouts"."discount_rupiah" <= "checkouts"."subtotal_rupiah")
);
--> statement-breakpoint
CREATE TABLE "payment_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" "payment_correction_kind" NOT NULL,
	"amount_rupiah" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"recorded_by_staff_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_corrections_amount_positive" CHECK ("payment_corrections"."amount_rupiah" > 0)
);
--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_recorded_by_staff_user_id_staff_users_id_fk" FOREIGN KEY ("recorded_by_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_barber_id_barber_profiles_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barber_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_created_by_staff_user_id_staff_users_id_fk" FOREIGN KEY ("created_by_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_payment_id_checkout_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."checkout_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_recorded_by_staff_user_id_staff_users_id_fk" FOREIGN KEY ("recorded_by_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_items_checkout_id_idx" ON "checkout_items" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "checkout_payments_checkout_id_idx" ON "checkout_payments" USING btree ("checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_payments_checkout_idempotency_unique" ON "checkout_payments" USING btree ("checkout_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_booking_id_unique" ON "checkouts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "checkouts_shop_created_idx" ON "checkouts" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "checkouts_customer_id_idx" ON "checkouts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "checkouts_barber_id_idx" ON "checkouts" USING btree ("barber_id");--> statement-breakpoint
CREATE INDEX "payment_corrections_payment_id_idx" ON "payment_corrections" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_corrections_payment_idempotency_unique" ON "payment_corrections" USING btree ("payment_id","idempotency_key");