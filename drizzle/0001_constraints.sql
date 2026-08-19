-- Rules the product depends on, held by the database rather than by a form.
--
-- A form can be bypassed by any route that forgets to call it; a check
-- constraint cannot. Each of these corresponds to a locked rule.

-- Cash out is in eighths of remaining stake, and only a partial cash out has
-- a fraction at all.
ALTER TABLE settlement_events
  ADD CONSTRAINT settlement_events_eighths_range
  CHECK (fraction_eighths IS NULL OR (fraction_eighths BETWEEN 1 AND 8));

ALTER TABLE settlement_events
  ADD CONSTRAINT settlement_events_eighths_only_partial
  CHECK (fraction_eighths IS NULL OR type = 'cash_out_partial');

ALTER TABLE settlement_events
  ADD CONSTRAINT settlement_events_type_known
  CHECK (type IN ('placed','won','lost','void','push','half_won','half_lost',
                  'cash_out_partial','cash_out_full','rule4','commission',
                  'promo_refund','manual_correction'));

ALTER TABLE bet_state
  ADD CONSTRAINT bet_state_status_known
  CHECK (status IN ('open','part_settled','settled'));

ALTER TABLE bets
  ADD CONSTRAINT bets_shape_known
  CHECK (shape IN ('single','multi_same_fixture','multi_cross_fixture','each_way','system'));

ALTER TABLE bets
  ADD CONSTRAINT bets_side_known
  CHECK (side IN ('back','lay'));

-- A lay bet without a liability is a lay bet whose risk is unknown, and every
-- figure computed from it would be wrong.
ALTER TABLE bets
  ADD CONSTRAINT bets_lay_needs_liability
  CHECK (side <> 'lay' OR liability_pence IS NOT NULL);

-- Antepost sits in its own bucket and is exempt from the settlement lag
-- nudge, which needs a date to measure against.
ALTER TABLE bets
  ADD CONSTRAINT bets_antepost_needs_expected
  CHECK (is_antepost = false OR expected_settle_at IS NOT NULL);

-- GBP and EUR only.
ALTER TABLE bets ADD CONSTRAINT bets_currency_supported CHECK (currency IN ('GBP','EUR'));
ALTER TABLE accounts ADD CONSTRAINT accounts_currency_supported CHECK (currency IN ('GBP','EUR'));

-- Duplicates match on selection, stake, bookmaker and event_at, not on image
-- hash alone, so a settled screenshot of a slip already logged from the
-- placement screenshot is recognised as the same bet.
CREATE INDEX IF NOT EXISTS bets_dupe_idx
  ON bets (account_id, event_at, stake_pence, bookmaker_id, selection);
