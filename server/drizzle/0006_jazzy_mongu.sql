CREATE TYPE "public"."organization_lifecycle" AS ENUM('trialing', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('organization_owner', 'organization_admin', 'organization_member');--> statement-breakpoint
CREATE TYPE "public"."shop_role" AS ENUM('shop_manager', 'receptionist', 'barber');--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'organization_member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"lifecycle" "organization_lifecycle" DEFAULT 'trialing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_memberships" (
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "shop_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_memberships_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"shop_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_memberships" ADD CONSTRAINT "shop_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_org_role_idx" ON "organization_memberships" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_lifecycle_idx" ON "organizations" USING btree ("lifecycle");--> statement-breakpoint
CREATE INDEX "shop_memberships_user_id_idx" ON "shop_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_memberships_shop_role_idx" ON "shop_memberships" USING btree ("shop_id","role");--> statement-breakpoint
CREATE INDEX "tenant_audit_logs_org_created_idx" ON "tenant_audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_audit_logs_shop_created_idx" ON "tenant_audit_logs" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "tenant_audit_logs_actor_created_idx" ON "tenant_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "barber_profiles_id_shop_unique" ON "barber_profiles" USING btree ("id","shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_id_shop_unique" ON "bookings" USING btree ("id","shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_id_shop_unique" ON "checkouts" USING btree ("id","shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_id_shop_unique" ON "customers" USING btree ("id","shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_id_shop_unique" ON "services" USING btree ("id","shop_id");--> statement-breakpoint
CREATE INDEX "shops_organization_id_idx" ON "shops" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_id_shop_unique" ON "staff_users" USING btree ("id","shop_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_customer_fk" FOREIGN KEY ("shop_id","customer_id") REFERENCES "public"."customers"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_service_fk" FOREIGN KEY ("shop_id","service_id") REFERENCES "public"."services"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_barber_fk" FOREIGN KEY ("shop_id","barber_id") REFERENCES "public"."barber_profiles"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shop_created_by_staff_fk" FOREIGN KEY ("shop_id","created_by_staff_user_id") REFERENCES "public"."staff_users"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_booking_fk" FOREIGN KEY ("shop_id","booking_id") REFERENCES "public"."bookings"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_customer_fk" FOREIGN KEY ("shop_id","customer_id") REFERENCES "public"."customers"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_barber_fk" FOREIGN KEY ("shop_id","barber_id") REFERENCES "public"."barber_profiles"("shop_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_shop_created_by_staff_fk" FOREIGN KEY ("shop_id","created_by_staff_user_id") REFERENCES "public"."staff_users"("shop_id","id") ON DELETE no action ON UPDATE no action;
