ALTER TABLE "barber_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checkouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "barber_profiles_tenant_context" ON "barber_profiles" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "barber_profiles"."shop_id"::text = current_setting('cukurpro.shop_id', true));--> statement-breakpoint
CREATE POLICY "bookings_tenant_context" ON "bookings" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "bookings"."shop_id"::text = current_setting('cukurpro.shop_id', true));--> statement-breakpoint
CREATE POLICY "checkouts_tenant_context" ON "checkouts" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "checkouts"."shop_id"::text = current_setting('cukurpro.shop_id', true));--> statement-breakpoint
CREATE POLICY "customers_tenant_context" ON "customers" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "customers"."shop_id"::text = current_setting('cukurpro.shop_id', true));--> statement-breakpoint
CREATE POLICY "organizations_tenant_context" ON "organizations" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.organization_id', true) = '' or "organizations"."id"::text = current_setting('cukurpro.organization_id', true));--> statement-breakpoint
CREATE POLICY "services_tenant_context" ON "services" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "services"."shop_id"::text = current_setting('cukurpro.shop_id', true));--> statement-breakpoint
CREATE POLICY "shops_tenant_context" ON "shops" AS PERMISSIVE FOR ALL TO public USING (current_setting('cukurpro.shop_id', true) = '' or "shops"."id"::text = current_setting('cukurpro.shop_id', true));