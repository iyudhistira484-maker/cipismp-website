CREATE INDEX "order_items_target_history_idx" ON "order_items" USING btree ("target_uuid","order_id");--> statement-breakpoint
CREATE INDEX "orders_user_history_idx" ON "orders" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_history_idx" ON "support_tickets" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_history_idx" ON "support_tickets" USING btree ("user_id","updated_at","id");