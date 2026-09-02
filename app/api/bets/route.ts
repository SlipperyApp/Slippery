import { hasDatabase, transaction } from '@/lib/server/db';
import { currentAccount, sha256 } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { writeState } from '@/lib/server/bets';
import { ALL_BOOKMAKERS, DEFAULT_BOOKMAKER_ID, marketGroupFor, resolveBookmakerId } from '@/lib/data/reference';
import { fingerprintSource, identityOf } from '@/lib/data/read';
import { currentBalance } from '@/lib/server/balances';
import { linkSlipToBet } from '@/lib/server/slips';
import type { Bet } from '@/lib/domain/types';

export const runtime = 'nodejs';

type LegInput = { selection?: string; eventName?: string; market?: string; odds?: string | number };

/** Create a bet. The bet, its legs and its bet_state row are written inside
 *  one transaction, so a request that fails leaves nothing half written. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'bets', 40, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const legsIn = Array.isArray(body.legs) ? (body.legs as LegInput[]) : [];
  const stakePence = Math.round(Number(body.stakePence) || 0);
  const lines = Math.max(1, Math.round(Number(body.lines) || 1));

  if (!legsIn.length) return fail(400, 'no_legs', 'A bet needs at least one selection.');
  if (stakePence < 1) return fail(400, 'no_stake', 'A stake is needed. Nothing was written.');

  const priced = legsIn.map((l) => Number(l.odds));
  if (priced.some((p) => !Number.isFinite(p) || p <= 1)) {
    return fail(400, 'bad_odds', 'Every selection needs a price above 1.00. A missing price is never guessed at.');
  }

  if (!hasDatabase()) {
    return fail(503, 'no_store',
      'This deployment has no database, so nothing was written. Everything you typed is still on screen.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session',
      'You are looking at the example account, so nothing was written. Start your own and this button writes to it.');
  }

  const shape = str(body.shape) || 'single';
  const side = str(body.side) === 'lay' ? 'lay' : 'back';
  const odds = Number(priced.reduce((a, b) => a * b, 1).toFixed(4));
  const eventAt = str(body.placedAt) || new Date().toISOString();
  const promo = (body.promotional ?? {}) as { freeBet?: boolean; boosted?: boolean; bonusFunds?: boolean };
  /*  Resolved to an ID, whatever the caller was holding. It used to be the
   *  raw string, so a review screen sending the name it had printed put
   *  "Betfair Exchange" into bookmaker_id, where the commission rate, the
   *  handicap convention and the breakdown row all failed to find it. The
   *  default stays for a slip whose bookmaker never read, and it is the same
   *  default /api/extract fingerprints with, or the duplicate check could
   *  never match its own writes. */
  const bookmakerId = resolveBookmakerId(str(body.bookmaker)) ?? DEFAULT_BOOKMAKER_ID;
  const eachWay = shape === 'each_way';

  /*  How many places the bookmaker paid, so a ledger can say "3rd of 12,
   *  places paid 1-3". Null unless it was actually on the slip: a place
   *  count is never inferred from a field size. */
  const placesRaw = Math.round(Number(body.placesPaid));
  const placesPaid = Number.isFinite(placesRaw) && placesRaw >= 1 && placesRaw <= 30 ? placesRaw : null;

  /*  What this bet is, hashed, so a second screenshot of the same slip can be
   *  recognised as the same BET rather than compared byte for byte against
   *  the first image and missed. Built through identityOf, which is the same
   *  recipe /api/extract matches against, or the two would never agree. */
  const fingerprint = sha256(fingerprintSource(identityOf({
    bookmaker: bookmakerId,
    stakePerLineMinor: stakePence,
    lines,
    eventAt,
    legs: legsIn.map((l) => ({ selection: str(l.selection), fixture: str(l.eventName), odds: Number(l.odds) })),
  })));

  /*  WHICH BOOKS THIS LANDS IN, and therefore what the stake is denominated
      in. The balance is the one the person has open, resolved from the cookie
      against their own balances rather than taken from the request: a client
      that could name a balance could name somebody else's, and a stake typed
      into the euro account and filed against the sterling one is a wrong
      figure on two screens at once. */
  const bal = await currentBalance(account.id);

  try {
    const betId = await transaction(async (client) => {
      const unit = await client.query<{ unit_pence: number; currency: string }>(
        'select unit_pence, currency from accounts where id = $1', [account.id],
      );
      const unitPence = bal?.unitPence ?? unit.rows[0]?.unit_pence ?? 2500;
      const currency = bal?.currency ?? unit.rows[0]?.currency ?? 'GBP';
      const total = stakePence * lines;

      /*  THE RATE WAS A LITERAL ZERO IN THIS INSERT. Every bet written
       *  through this route carried commission_pct 0, so an exchange winner
       *  had nothing to charge even once settlement learned to charge it, and
       *  the whole ledger read 2 per cent high. It is the account's own rate
       *  for that bookmaker, frozen at placement like the unit beside it, so
       *  changing the rate later never rewrites history. */
      const rate = await client.query<{ commission_pct: string }>(
        'select commission_pct from bookmakers where account_id = $1 and id = $2', [account.id, bookmakerId],
      );
      const commissionPct = rate.rows.length
        ? Number(rate.rows[0].commission_pct)
        : (ALL_BOOKMAKERS.find((b) => b.id === bookmakerId)?.commissionPct ?? 0);

      const inserted = await client.query<{ id: string }>(
        `insert into bets
           (account_id, shape, side, stake_pence, liability_pence, odds, currency,
            bookmaker_id, sport_id, event_name, selection, market_raw, market_group_id,
            event_at, placed_at, is_free_bet, is_boosted, is_bonus_funds,
            is_each_way, places_paid, slip_backed, source, unit_pence_at_placement,
            commission_pct, bet_fingerprint)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now(),
                 $16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         returning id`,
        [
          account.id,
          bal?.id ?? null,
          legsIn.length > 1 ? 'multi_cross_fixture' : eachWay ? 'each_way' : 'single',
          side, total,
          side === 'lay' ? Math.round(total * (odds - 1)) : null,
          odds, currency,
          bookmakerId,
          str(body.sport) || 'football',
          str(legsIn[0]?.eventName) || '',
          legsIn.map((l) => str(l.selection)).join(' / '),
          str(legsIn[0]?.market) || 'Match result',
          marketGroupFor(str(legsIn[0]?.market)),
          eventAt,
          Boolean(promo.freeBet), Boolean(promo.boosted), Boolean(promo.bonusFunds),
          eachWay, placesPaid,
          str(body.source) !== 'manual',
          str(body.source) || 'manual',
          unitPence,
          commissionPct,
          fingerprint,
        ],
      );
      const id = inserted.rows[0].id;

      for (let i = 0; i < legsIn.length; i++) {
        const l = legsIn[i];
        await client.query(
          `insert into bet_legs (bet_id, seq, selection, market_raw, event_name, leg_odds, leg_result, event_at)
           values ($1,$2,$3,$4,$5,$6,'open',$7)`,
          [id, i + 1, str(l.selection), str(l.market), str(l.eventName), Number(l.odds), eventAt],
        );
      }

      // bet_state is written by the fold, here as everywhere else.
      const bet: Bet = {
        id, accountId: account.id, balanceId: bal?.id ?? '', shape: 'single', side: side as 'back' | 'lay',
        stakePence: total, liabilityPence: side === 'lay' ? Math.round(total * (odds - 1)) : null,
        odds, currency: currency as 'GBP' | 'EUR', fxRate: null,
        bookmakerId, tipsterId: null,
        sportId: (str(body.sport) || 'football') as Bet['sportId'],
        competition: null, course: null, eventName: '', selection: '', marketRaw: '',
        marketGroupId: null, eventAt, placedAt: eventAt, expectedSettleAt: null,
        isFreeBet: Boolean(promo.freeBet), isBonusFunds: Boolean(promo.bonusFunds),
        isBoosted: Boolean(promo.boosted), isEachWay: eachWay,
        ewPlaceFraction: null, ewPart: null, ewGroupId: null, placesPaid,
        slipBacked: str(body.source) !== 'manual', source: 'manual',
        /*  A bet is placed before the market closes, so there is never a
            closing price at this moment. It is recorded later, by hand. */
        closingOdds: null,
        arbGroupId: null, note: null, unitPenceAtPlacement: unitPence, commissionPct,
        createdAt: eventAt,
        legs: legsIn.map((l, i) => ({
          id: `${id}-${i}`, betId: id, seq: i + 1, selection: str(l.selection),
          marketRaw: str(l.market), fixtureId: null, eventName: str(l.eventName),
          legOdds: Number(l.odds), legResult: 'open' as const, eventAt,
        })),
      };
      await writeState(client, bet, []);

      /*  THE SLIP THIS BET CAME FROM, bound to it here.
       *
       *  The image is stored by /api/extract, which is where the bytes are,
       *  and it has no bet until this moment. Binding it inside the bet's own
       *  transaction is what stops a bet existing with its evidence orphaned,
       *  or an image being kept for ninety days for a bet that was never
       *  written. The hash travels from the read through the review screen;
       *  a bet typed in by hand sends none and is marked as typed in. */
      const slipHash = str(body.sha256);
      if (slipHash) await linkSlipToBet(client, account.id, slipHash, id);

      await client.query(
        `insert into audit_log (account_id, entity, entity_id, action, source)
         values ($1, 'bet', $2, 'create', $3)`,
        [account.id, id, str(body.source) || 'manual'],
      );

      return id;
    });

    return ok({ betId, message: 'Written, with its bet_state folded in the same transaction.' });
  } catch {
    return fail(500, 'write_failed',
      'That failed and nothing was saved: the bet, its legs and its state are written in one transaction.');
  }
}
