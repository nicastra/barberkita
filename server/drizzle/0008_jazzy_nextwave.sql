ALTER TABLE "audit_logs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "barber_breaks" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "barber_schedule_exceptions" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "barber_services" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "barber_working_hours" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "checkout_items" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "checkout_payments" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "shops_organization_id_id_unique" ON "shops" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_payments_id_shop_unique" ON "checkout_payments" USING btree ("id","shop_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_breaks" ADD CONSTRAINT "barber_breaks_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_schedule_exceptions" ADD CONSTRAINT "barber_schedule_exceptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_shop_barber_fk" FOREIGN KEY ("shop_id","barber_id") REFERENCES "public"."barber_profiles"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_shop_service_fk" FOREIGN KEY ("shop_id","service_id") REFERENCES "public"."services"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_working_hours" ADD CONSTRAINT "barber_working_hours_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_shop_booking_fk" FOREIGN KEY ("shop_id","booking_id") REFERENCES "public"."bookings"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_items" ADD CONSTRAINT "checkout_items_shop_checkout_fk" FOREIGN KEY ("shop_id","checkout_id") REFERENCES "public"."checkouts"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_shop_checkout_fk" FOREIGN KEY ("shop_id","checkout_id") REFERENCES "public"."checkouts"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_corrections" ADD CONSTRAINT "payment_corrections_shop_payment_fk" FOREIGN KEY ("shop_id","payment_id") REFERENCES "public"."checkout_payments"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_organization_shop_fk" FOREIGN KEY ("organization_id","shop_id") REFERENCES "public"."shops"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_organization_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_memberships"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_breaks_shop_id_idx" ON "barber_breaks" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "barber_schedule_exceptions_shop_id_idx" ON "barber_schedule_exceptions" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "barber_services_shop_id_idx" ON "barber_services" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "barber_working_hours_shop_id_idx" ON "barber_working_hours" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "booking_events_shop_id_idx" ON "booking_events" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "checkout_items_shop_id_idx" ON "checkout_items" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "checkout_payments_shop_id_idx" ON "checkout_payments" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "payment_corrections_shop_id_idx" ON "payment_corrections" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "shop_memberships_organization_id_idx" ON "shop_memberships" USING btree ("organization_id");--> statement-breakpoint
