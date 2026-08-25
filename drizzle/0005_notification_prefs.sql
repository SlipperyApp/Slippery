-- 17 · Which Telegram messages an account wants.
--
-- jsonb rather than a column per switch: the list will change, and a
-- migration for every new notification is not a trade worth taking. A missing
-- key means the default, so adding a notification never needs a backfill.
--
-- Defaults live in the application (lib/notifications.ts), not here, because
-- "off except settled and overtaken" is a product rule and product rules that
-- live in a column default are invisible to everyone reading the product.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb;
