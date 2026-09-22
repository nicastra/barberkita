ALTER TABLE "shops" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug_unique" ON "shops" USING btree ("slug");