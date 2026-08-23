-- Build spec 3, items 55 to 58. Four things the product could not represent.
--
-- 58  A bet keeps the unit it was placed at, so raising your unit does not
--     halve every figure in your history. Cannot be backfilled truthfully,
--     which is why it lands before real data does.
-- 57  Starting bankroll and balance stop sharing one word, and deposits and
--     withdrawals become recordable so balance can be right for anyone who
--     tops up.
-- 56  Exchange commission, resolved per bet from the bookmaker's rate.
-- 55  Each way becomes two child legs rather than a seventh outcome.

ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "unit_at_placement_pence" integer;
ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "commission_pct" numeric(5,2);
ALTER TABLE "bets" ADD COLUMN IF NOT EXISTS "ew_places_paid" smallint;

ALTER TABLE "bet_legs" ADD COLUMN IF NOT EXISTS "kind" text;
ALTER TABLE "bet_legs" ADD COLUMN IF NOT EXISTS "leg_stake_pence" integer;

-- Only the two parts of an each-way bet carry a kind; an ordinary leg of a
-- multiple has none. Enforced here rather than only in the form, because the
-- settlement fold branches on it.
ALTER TABLE "bet_legs" DROP CONSTRAINT IF EXISTS "bet_legs_kind_ck";
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_kind_ck"
  CHECK ("kind" IS NULL OR "kind" IN ('win','place'));

-- A commission rate is a percentage, and a negative one would pay the punter.
ALTER TABLE "bets" DROP CONSTRAINT IF EXISTS "bets_commission_ck";
ALTER TABLE "bets" ADD CONSTRAINT "bets_commission_ck"
  CHECK ("commission_pct" IS NULL OR ("commission_pct" >= 0 AND "commission_pct" <= 100));

-- Places paid is 1 or more where it is set at all.
ALTER TABLE "bets" DROP CONSTRAINT IF EXISTS "bets_ew_places_ck";
ALTER TABLE "bets" ADD CONSTRAINT "bets_ew_places_ck"
  CHECK ("ew_places_paid" IS NULL OR "ew_places_paid" >= 1);

CREATE TABLE IF NOT EXISTS "bankroll_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "adjusted_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- Positive is money in, negative is money out. One signed column rather
  -- than a type and a magnitude that have to agree with each other.
  "amount_pence" integer NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bankroll_adjustments_nonzero_ck" CHECK ("amount_pence" <> 0)
);
CREATE INDEX IF NOT EXISTS "bankroll_adjustments_account_idx"
  ON "bankroll_adjustments" ("account_id","adjusted_at");

CREATE TABLE IF NOT EXISTS "unit_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE cascade,
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "unit_pence" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unit_history_positive_ck" CHECK ("unit_pence" > 0)
);
CREATE INDEX IF NOT EXISTS "unit_history_account_idx"
  ON "unit_history" ("account_id","effective_from");

-- Backfill, honestly. Existing bets get the account's current unit, which is
-- the only unit that was ever in force for them, and the account's first unit
-- change is recorded as having applied since before any of them.
UPDATE "bets" b SET "unit_at_placement_pence" = a."unit_pence"
  FROM "accounts" a
 WHERE b."account_id" = a."id"
   AND b."unit_at_placement_pence" IS NULL
   AND a."unit_pence" IS NOT NULL;

INSERT INTO "unit_history" ("account_id","effective_from","unit_pence")
SELECT a."id", '1970-01-01T00:00:00Z'::timestamptz, a."unit_pence"
  FROM "accounts" a
 WHERE a."unit_pence" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "unit_history" h WHERE h."account_id" = a."id");

-- Commission takes the bookmaker's rate where the bet has one and the
-- bookmaker has a rate set. A bet with no exchange behind it stays null,
-- which the fold reads as zero.
UPDATE "bets" b SET "commission_pct" = k."commission_pct"
  FROM "bookmakers" k
 WHERE b."bookmaker_id" = k."id"
   AND b."commission_pct" IS NULL
   AND k."commission_pct" IS NOT NULL;
