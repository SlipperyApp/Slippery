-- The closing price, recorded by hand.
--
-- A closing line value module existed in this product once with no closing
-- price behind it, so what it printed on every account on every day was "Not
-- measured" and a paragraph explaining why. It was deleted, correctly: a
-- module whose only job is to say it has nothing to say takes a slot on the
-- first screen and teaches the reader that some of the figures here do not
-- work.
--
-- What changed is not the maths, it is where the number comes from. This
-- column holds a price somebody looked up after the off and typed in. Nothing
-- computes, estimates, models or infers one, and there is no default: NULL is
-- the normal state of this column and it means nobody has recorded a closing
-- price for that bet. A null is not a zero, and no figure derived from this
-- column may treat it as one.
--
-- numeric(12,4) to match `odds` on the same row. Comparing a price stored to
-- four places with one stored to two would make a pair of identical prices
-- differ, and the difference would be printed as beating the market by a
-- hundredth of a per cent.
alter table bets add column if not exists closing_odds numeric(12,4);

-- A price above 1.00 or nothing at all. The check is here rather than only in
-- the route because a closing price arrives from a form, from an import and
-- from the bot, and a 0 in this column would divide into the price taken and
-- produce an infinity on somebody's dashboard.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bets_closing_odds_sane'
  ) then
    alter table bets add constraint bets_closing_odds_sane
      check (closing_odds is null or (closing_odds > 1 and closing_odds < 10000));
  end if;
end $$;
