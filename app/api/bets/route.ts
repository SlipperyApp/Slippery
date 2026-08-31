import { hasDatabase, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { writeState } from '@/lib/server/bets';
import { marketGroupFor } from '@/lib/data/reference';
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

  try {
    const betId = await transaction(async (client) => {
      const unit = await client.query<{ unit_pence: number; currency: string }>(
        'select unit_pence, currency from accounts where id = $1', [account.id],
      );
      const unitPence = unit.rows[0]?.unit_pence ?? 2500;
      const currency = unit.rows[0]?.currency ?? 'GBP';
      const total = stakePence * lines;

      const inserted = await client.query<{ id: string }>(
        `insert into bets
           (account_id, shape, side, stake_pence, liability_pence, odds, currency,
            bookmaker_id, sport_id, event_name, selection, market_raw, market_group_id,
            event_at, placed_at, is_free_bet, is_boosted, is_bonus_funds,
            slip_backed, source, unit_pence_at_placement, commission_pct)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(),$15,$16,$17,$18,$19,$20,0)
         returning id`,
        [
          account.id,
          legsIn.length > 1 ? 'multi_cross_fixture' : shape === 'each_way' ? 'each_way' : 'single',
          side, total,
          side === 'lay' ? Math.round(total * (odds - 1)) : null,
          odds, currency,
          str(body.bookmaker) || 'bet365',
          str(body.sport) || 'football',
          str(legsIn[0]?.eventName) || '',
          legsIn.map((l) => str(l.selection)).join(' / '),
          str(legsIn[0]?.market) || 'Match result',
          marketGroupFor(str(legsIn[0]?.market)),
          eventAt,
          Boolean(promo.freeBet), Boolean(promo.boosted), Boolean(promo.bonusFunds),
          str(body.source) !== 'manual',
          str(body.source) || 'manual',
          unitPence,
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
        id, accountId: account.id, shape: 'single', side: side as 'back' | 'lay',
        stakePence: total, liabilityPence: side === 'lay' ? Math.round(total * (odds - 1)) : null,
        odds, currency: currency as 'GBP' | 'EUR', fxRate: null,
        bookmakerId: str(body.bookmaker) || 'bet365', tipsterId: null,
        sportId: (str(body.sport) || 'football') as Bet['sportId'],
        competition: null, course: null, eventName: '', selection: '', marketRaw: '',
        marketGroupId: null, eventAt, placedAt: eventAt, expectedSettleAt: null,
        isFreeBet: Boolean(promo.freeBet), isBonusFunds: Boolean(promo.bonusFunds),
        isBoosted: Boolean(promo.boosted), isEachWay: shape === 'each_way',
        ewPlaceFraction: null, ewPart: null, ewGroupId: null,
        slipBacked: str(body.source) !== 'manual', source: 'manual',
        arbGroupId: null, note: null, unitPenceAtPlacement: unitPence, commissionPct: 0,
        createdAt: eventAt,
        legs: legsIn.map((l, i) => ({
          id: `${id}-${i}`, betId: id, seq: i + 1, selection: str(l.selection),
          marketRaw: str(l.market), fixtureId: null, eventName: str(l.eventName),
          legOdds: Number(l.odds), legResult: 'open' as const, eventAt,
        })),
      };
      await writeState(client, bet, []);

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
