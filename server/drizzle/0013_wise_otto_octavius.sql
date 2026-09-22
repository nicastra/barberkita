CREATE UNIQUE INDEX IF NOT EXISTS "checkout_payments_id_shop_unique" ON "checkout_payments" USING btree ("id","shop_id");
