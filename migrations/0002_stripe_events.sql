-- Stripe webhook idempotency.
--
-- Every handler in the webhook is idempotent EXCEPT the failed payment
-- counter, and that one decides whether an account goes read only. Stripe
-- retries on any non-200, and the route answers 200 even when a write throws,
-- so a duplicate is unlikely rather than impossible; a duplicate of THAT
-- event puts a paying account into read only after one real failure.
--
-- Same shape as telegram_updates, for the same reason.

create table if not exists stripe_events (
  event_id text primary key,
  type     text not null,
  seen_at  timestamptz not null default now()
);
