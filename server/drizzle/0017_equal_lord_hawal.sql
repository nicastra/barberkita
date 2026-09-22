CREATE TYPE "public"."support_grant_status" AS ENUM('pending_approval', 'active', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "support_grant_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_user_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"reason" text NOT NULL,
	"status" "support_grant_status" DEFAULT 'pending_approval' NOT NULL,
	"break_glass" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_grant_events" ADD CONSTRAINT "support_grant_events_grant_id_support_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."support_grants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grant_events" ADD CONSTRAINT "support_grant_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grant_events" ADD CONSTRAINT "support_grant_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_provider_user_id_users_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_grants" ADD CONSTRAINT "support_grants_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_grant_events_grant_created_idx" ON "support_grant_events" USING btree ("grant_id","created_at");--> statement-breakpoint
CREATE INDEX "support_grant_events_organization_created_idx" ON "support_grant_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "support_grants_organization_status_idx" ON "support_grants" USING btree ("organization_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "support_grants_provider_status_idx" ON "support_grants" USING btree ("provider_user_id","status","expires_at");