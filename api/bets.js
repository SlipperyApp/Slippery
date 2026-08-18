/* /api/bets, the user's ledger.
 *
 *   GET    /api/bets                list every bet, newest first
 *   POST   /api/bets                log one (a confirmed slip, or manual)
 *   PATCH  /api/bets   {id, ...}    settle it by hand, or cash it out
 *   DELETE /api/bets   {id}         remove one logged in error
 *
 * Money is integer pence on the wire and in the column, exactly as it is in
 * the browser. There is no float anywhere in the path, because a penny of
 * rounding drift in a profit-and-loss tracker is a bug the user cannot see
 * and cannot correct.
 *
 * Cash out is only ever a user action. The brief is explicit that it cannot
 * be detected from a results feed, so it arrives here through PATCH and
 * nowhere else.
 */
import { json, methodGuard, readJson, fail, clientIp, blockCrossOrigin } from './_lib/http.js';
import { db, ensureSchema, configured } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { cashOutcome, ledgerOutcome, payoutFor } from '../src/js/settlement.js';
import { bookName } from '../src/js/books.js';
import { betProblem, cleanLegs, isMulti, inferBetType, BET_TYPES } from '../src/js/betshape.js';
import { limit } from './_lib/rate.js';
import { unlimited, trialState, TRIAL_SLIPS, billingState } from './_lib/promo.js';
import { onBreak } from './_lib/routes/break.js';

/* The free trial: two weeks or 35 slips, whichever goes first. Counted on
   the server, because a limit enforced in the browser is a suggestion. */
const FREE_SLIPS = TRIAL_SLIPS;

/* limit() answers {allowed, retryAfter}. Testing the object is always true,
   which silently disabled both burst limits below. */
const allowed = async (...args) => (await limit(...args)).allowed;

/* Paid, gifted or free-for-life all mean the same thing here: no cap. */
const capped = user => !unlimited(user.plan, user.plan_until);

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  /* Second layer behind SameSite=Lax. A write arriving from another origin
     is refused before it can spend a session it did not earn. */
  if (blockCrossOrigin(req, res)) return;
  try {
    if (!configured()) {
      return json(res, 503, {
        error: 'No database is connected yet.', needs: ['DATABASE_URL']
      });
    }
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to see your bets.' });

    if (req.method === 'GET') return list(res, user);

    const body = await readJson(req, 256 * 1024);
    /* Period profit and loss rides on this endpoint rather than its own,
       because Vercel Hobby allows twelve functions in total and this is
       ledger data by any reading. The discriminator is explicit so a
       malformed bet can never be mistaken for one. */
    /* A break stops anything that ADDS to the record. Reading it stays
       open on purpose: somebody on a break should still be able to look at
       what they already have, and locking them out of their own history
       would make the break something to avoid taking. */
    /* LOCKED FOR NON-PAYMENT. Reading is always allowed: the record is the
       user's and withholding it over a failed card would be holding
       somebody's own history to ransom. Writing stops until it is paid. */
    if (req.method !== 'GET') {
      const bill = billingState({
        plan: user.plan, planUntil: user.plan_until, cardAdded: user.card_added,
        chargeDueAt: user.charge_due_at, chargePaidAt: user.charge_paid_at
      });
      if (bill.locked) {
        return json(res, 423, {
          error: 'This account is locked because a payment did not go through. ' +
            'Everything you have logged is still here and nothing has been deleted.',
          locked: true, billing: bill
        });
      }
    }

    if (req.method !== 'GET' && onBreak(user)) {
      return json(res, 423, {
        error: 'You are on a break until ' +
          new Date(user.break_until).toLocaleDateString('en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' }) +
          '. Nothing new can be logged until then.',
        breakUntil: user.break_until
      });
    }
    if (body && Array.isArray(body.pl)) return savePl(res, user, body.pl);
    if (body && body.removePl) return removePl(res, user, body.removePl);
    if (req.method === 'POST') return create(req, res, user, body);
    if (req.method === 'PATCH') return update(res, user, body);
    return remove(res, user, body);
  } catch (err) {
    return fail(res, err, 'Could not reach your ledger.');
  }
}

/* ---------------- read ---------------- */
async function list(res, user) {
  const sql = db();
  const rows = await sql`
    SELECT id, event, selection, market, bookmaker, odds, stake_pence,
           profit_pence, outcome, status, capture_stage, placed_at, settled_at,
           settle_reason, source, bet_type, legs
    FROM bets WHERE user_id = ${user.id}
    ORDER BY placed_at DESC LIMIT 2000`;
  const counted = await sql`
    SELECT count(*)::int AS n FROM bets WHERE user_id = ${user.id}`;
  /* The capture rate, computed in the database rather than from the 2000
     rows the list is capped at, so it stays true for an account with more
     bets than the page shows. */
  const cap = await sql`
    SELECT
      count(*) FILTER (WHERE capture_stage IS NOT NULL)::int AS known,
      count(*) FILTER (WHERE capture_stage = 'prematch')::int AS prematch,
      count(*) FILTER (WHERE capture_stage = 'inplay')::int AS inplay,
      count(*) FILTER (WHERE capture_stage = 'settled')::int AS settled
    FROM bets WHERE user_id = ${user.id}`;
  const pl = await sql`
    SELECT id, on_date, period, profit_pence, turnover_pence, bets, note, source
    FROM pl_entries WHERE user_id = ${user.id}
    ORDER BY on_date DESC LIMIT 1000`;
  return json(res, 200, {
    bets: rows.map(shape),
    /* Period figures, separate from bets on purpose: they have no slips
       behind them and nothing that counts bets may count these. */
    pl: pl.map(shapePl),
    total: counted[0].n,
    /* Null when nothing has a known stage, which is different from zero
       percent and has to stay different: one means "not measured", the
       other means "every bet was logged after the fact". */
    capture: cap[0].known ? {
      known: cap[0].known,
      prematch: cap[0].prematch,
      inplay: cap[0].inplay,
      settled: cap[0].settled,
      rate: Math.round(cap[0].prematch / cap[0].known * 100)
    } : null,
    freeSlips: FREE_SLIPS,
    plan: user.plan || 'free',
    planUntil: user.plan_until || null,
    unlimited: !capped(user),
    breakUntil: user.break_until || null,
    trial: capped(user)
      ? trialState({ slipsUsed: counted[0].n, trialEndsAt: user.trial_ends_at })
      : null
  });
}

/* ---------------- period profit and loss ----------------
 *
 * Figures somebody has for a day, week or month with no slips behind them:
 * typed in, or lifted off a screenshot from another tracker. They are not
 * bets, they never become bets, and nothing here can settle.
 *
 * The write is an upsert keyed on (user, date, period), which is what makes
 * importing the same screenshot twice safe: the second run corrects the
 * first rather than doubling every figure. That is not a nicety. A P/L
 * import is exactly the operation somebody retries when they are not sure
 * it worked.
 */
const PL_PERIODS = ['day', 'week', 'month', 'year'];
const MAX_PL_ROWS = 400;
/* A date has to be a real one and inside a range a person could mean.
   Far-future dates are allowed on purpose: the brief asks for future days
   to be selectable, and somebody recording a bet placed today on a game
   next month has a legitimate reason to. */
const PL_MIN = Date.UTC(2000, 0, 1);
const PL_MAX = Date.UTC(2100, 0, 1);

function plProblem(row) {
  if (!row || typeof row !== 'object') return 'Nothing to save.';
  if (!PL_PERIODS.includes(row.period)) return 'That is not a period.';
  const iso = String(row.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'A profit figure needs a date.';
  const t = Date.parse(iso + 'T00:00:00Z');
  if (!Number.isFinite(t) || t < PL_MIN || t >= PL_MAX) return 'That date is not usable.';
  /* Round-trip check: 2026-02-31 parses in some engines and is not a day. */
  if (new Date(t).toISOString().slice(0, 10) !== iso) return 'That date does not exist.';
  const p = Number(row.profitPence);
  if (!Number.isFinite(p) || Math.round(p) !== p) return 'Profit is whole pence.';
  if (Math.abs(p) > 1_000_000_00) return 'That figure is larger than this tracker supports.';
  return '';
}

async function savePl(res, user, rows) {
  if (!rows.length) return json(res, 400, { error: 'Nothing to save.' });
  if (rows.length > MAX_PL_ROWS) {
    return json(res, 413, { error: 'That is more than ' + MAX_PL_ROWS + ' figures at once.' });
  }
  if (!(await allowed('pl:' + user.id, 60, 3600))) {
    return json(res, 429, { error: 'Too many at once. Try again shortly.' });
  }

  const rejected = [];
  const good = [];
  rows.forEach((row, i) => {
    const problem = plProblem(row);
    if (problem) rejected.push({ i, why: problem });
    else good.push(row);
  });
  if (!good.length) return json(res, 400, { error: rejected[0].why, rejected });

  const sql = db();
  let saved = 0;
  for (const row of good) {
    await sql`
      INSERT INTO pl_entries (user_id, on_date, period, profit_pence, turnover_pence, bets, note, source)
      VALUES (${user.id}, ${row.date}, ${row.period}, ${Math.round(row.profitPence)},
              ${row.turnoverPence == null ? null : Math.round(row.turnoverPence)},
              ${row.bets == null ? null : Math.round(row.bets)},
              ${row.note ? String(row.note).slice(0, 120) : null},
              ${row.source === 'import' ? 'import' : 'typed'})
      ON CONFLICT (user_id, on_date, period) DO UPDATE
      SET profit_pence = EXCLUDED.profit_pence,
          turnover_pence = EXCLUDED.turnover_pence,
          bets = EXCLUDED.bets,
          note = EXCLUDED.note,
          source = EXCLUDED.source`;
    saved++;
  }
  return json(res, 201, { saved, rejected });
}

async function removePl(res, user, id) {
  const sql = db();
  const rows = await sql`
    DELETE FROM pl_entries WHERE id = ${String(id)} AND user_id = ${user.id} RETURNING id`;
  if (!rows.length) return json(res, 404, { error: 'That figure is not in your ledger.' });
  return json(res, 200, { removedPl: rows[0].id });
}

const shapePl = r => ({
  id: r.id,
  /* pg hands back a Date for a date column; the client wants the plain day
     it was told, with no timezone shifting it by one. */
  date: r.on_date instanceof Date ? r.on_date.toISOString().slice(0, 10) : String(r.on_date).slice(0, 10),
  period: r.period,
  profit: r.profit_pence,
  turnover: r.turnover_pence,
  bets: r.bets,
  note: r.note || '',
  source: r.source
});

/* One shape for the client, so the browser never has to know about column
   names or numeric-as-string. `odds` comes back from pg as a string. */
function shape(r) {
  return {
    id: r.id,
    event: r.event || '',
    selection: r.selection || '',
    market: r.market || '',
    book: r.bookmaker || '',
    odds: r.odds == null ? null : Number(r.odds),
    stake: r.stake_pence,
    profit: r.profit_pence == null ? null : r.profit_pence,
    outcome: r.outcome,
    status: r.status,
    placedAt: r.placed_at,
    settledAt: r.settled_at,
    reason: r.settle_reason,
    source: r.source,
    /* A single has neither, and null is the honest answer for the rows
       that predate the columns. The renderers fall back to the selection
       string, which is all those rows ever had. */
    betType: r.bet_type || null,
    legs: Array.isArray(r.legs) ? r.legs : null
  };
}

/* ---------------- create ---------------- */
async function create(req, res, user, body) {
  /* A CSV import arrives as {bets:[...]}; a confirmed slip as one bet. Both
     go through the same validation and the same free-tier count, so an
     import cannot be used to walk around the limit. */
  if (Array.isArray(body && body.bets)) return createMany(req, res, user, body.bets);

  const problem = betProblem(body);
  if (problem) return json(res, 400, { error: problem });

  const sql = db();
  /* The free tier is a count of bets ever logged, not bets currently held,
     so deleting bets cannot be used to reset it. */
  if (capped(user)) {
    const used = await sql`SELECT count(*)::int AS n FROM bets WHERE user_id = ${user.id}`;
    const trial = trialState({ slipsUsed: used[0].n, trialEndsAt: user.trial_ends_at });
    if (!trial.active) {
      return json(res, 402, {
        error: trial.over === 'time'
          ? 'Your two week free trial has finished.'
          : 'You have used all ' + FREE_SLIPS + ' slips in your free trial.',
        upgrade: true, over: trial.over, used: used[0].n, freeSlips: FREE_SLIPS, trial
      });
    }
  }
  /* A burst of uploads is normal; a thousand a minute is not. */
  if (!(await allowed('bets:' + user.id, 120, 60))) {
    return json(res, 429, { error: 'Slow down a moment and try again.' });
  }

  const stake = Math.round(Number(body.stakePence));
  const odds = body.odds == null ? null : Number(body.odds);
  const placedAt = body.placedAt ? new Date(body.placedAt) : new Date();

  /* A slip can be forwarded before kick-off, in play, or after it settled.
     Only the third carries a result, and only a result the slip actually
     stated, never one inferred here. Everything else lands pending and the
     results lookup grades it. */
  const settledNow = body.outcome && body.profitPence != null;
  const outcome = settledNow ? importOutcome(body) : null;
  const profit = settledNow && outcome ? Math.round(Number(body.profitPence)) : null;

  /* The legs and the type travel together or not at all: a type saying
     "accumulator" over a row with no legs is worse than no type, because
     the grader would believe it. */
  const legs = cleanLegs(body.legs);
  const betType = betTypeOf(body.betType, legs);

  const rows = await sql`
    INSERT INTO bets (user_id, event, selection, market, bookmaker, odds,
                      stake_pence, profit_pence, outcome, status, capture_stage, placed_at,
                      settled_at, settle_reason, source, bet_type, legs)
    VALUES (${user.id}, ${str(body.event)}, ${str(body.selection)}, ${str(body.market)},
            ${str(bookName(body.book))}, ${odds}, ${stake},
            ${profit}, ${outcome},
            ${outcome ? 'settled' : 'pending'}, ${captureStage(body)}, ${placedAt},
            ${outcome ? new Date() : null},
            ${outcome ? 'Result read from the slip' : null},
            ${body.source === 'telegram' ? 'telegram' : 'upload'},
            ${betType}, ${legs ? JSON.stringify(legs) : null})
    RETURNING id, event, selection, market, bookmaker, odds, stake_pence,
              profit_pence, outcome, status, placed_at, settled_at, settle_reason, source,
              bet_type, legs`;
  return json(res, 201, { bet: shape(rows[0]) });
}

/* Bulk import. Partial success is the honest outcome: 200 good rows out of
   210 should land, with the 10 reported by line, rather than the whole file
   being refused because one row had no stake. */
const MAX_IMPORT = 1000;

async function createMany(req, res, user, rows) {
  if (!rows.length) return json(res, 400, { error: 'That file had no bets in it.' });
  if (rows.length > MAX_IMPORT) {
    return json(res, 413, { error: 'That is more than ' + MAX_IMPORT + ' bets. Split the file.' });
  }
  if (!(await allowed('import:' + user.id, 6, 300))) {
    return json(res, 429, { error: 'Give the last import a moment to finish.' });
  }

  const sql = db();
  if (capped(user)) {
    const used = await sql`SELECT count(*)::int AS n FROM bets WHERE user_id = ${user.id}`;
    const trial = trialState({ slipsUsed: used[0].n, trialEndsAt: user.trial_ends_at });
    if (!trial.active) {
      return json(res, 402, {
        error: trial.over === 'time'
          ? 'Your two week free trial has finished.'
          : 'You have used all ' + FREE_SLIPS + ' slips in your free trial.',
        upgrade: true, over: trial.over, used: used[0].n, freeSlips: FREE_SLIPS, trial
      });
    }
    if (used[0].n + rows.length > FREE_SLIPS) {
      return json(res, 402, {
        error: 'That import needs ' + rows.length + ' slips and you have ' +
               trial.slipsLeft + ' left in your free trial.',
        upgrade: true, used: used[0].n, freeSlips: FREE_SLIPS, trial
      });
    }
  }

  const rejected = [];
  const good = [];
  rows.forEach((r, i) => {
    const problem = betProblem(r);
    if (problem) rejected.push({ line: r.line || i + 1, why: problem });
    else good.push(r);
  });
  if (!good.length) return json(res, 400, { error: 'No row in that file could be imported.', rejected });

  /* DUPLICATES.
   *
   * When an import folded rows into dated figures the write upserted on
   * (user, date, period), so re-importing the same file corrected rather
   * than doubled. Bets append, so that safety has to be built rather than
   * inherited: without it, importing the same export twice silently
   * doubles somebody's entire record.
   *
   * Four fields have to match, all of them: the day, the selection, the
   * stake and the bookmaker. Three matching is a coincidence, two people
   * really do back the same selection twice in a day at different stakes.
   * The day rather than the timestamp, because a spreadsheet rarely
   * carries a time and re-exporting can move it.
   *
   * One query for the whole window instead of one per row: a 1000 row
   * import would otherwise be 1000 round trips before it wrote anything.
   */
  const dayKey = v => {
    const d = v ? new Date(v) : new Date();
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  /* Folded through the registry before it becomes a key, or "Bet 365" and
     "bet365" are two different bets on the same day for the same stake. */
  const keyOf = (day, selection, stakePence, book) =>
    day + '|' + String(selection || '').trim().toLowerCase() +
    '|' + Math.round(Number(stakePence)) + '|' + bookName(book).trim().toLowerCase();

  const days = [...new Set(good.map(b => dayKey(b.placedAt)))].filter(Boolean);
  const seen = new Set();
  if (days.length) {
    const existing = await sql`
      SELECT to_char(placed_at, 'YYYY-MM-DD') AS day, selection, stake_pence, bookmaker
      FROM bets
      WHERE user_id = ${user.id}
        AND to_char(placed_at, 'YYYY-MM-DD') = ANY(${days})`;
    for (const row of existing) {
      seen.add(keyOf(row.day, row.selection, row.stake_pence, row.bookmaker));
    }
  }

  /* An imported row may already be settled, that is the point of importing
     history, so outcome and profit come across with it. Anything without a
     result lands as pending and the sweep will grade it. */
  let inserted = 0;
  const duplicates = [];
  for (const b of good) {
    const key = keyOf(dayKey(b.placedAt), b.selection, b.stakePence, b.book);
    /* Checked against the rows already written by THIS import too, so a
       file containing the same bet twice is caught as well as a file
       imported twice. */
    if (seen.has(key)) {
      duplicates.push({ line: b.line || null, selection: str(b.selection) });
      continue;
    }
    seen.add(key);
    const settled = b.outcome && b.profitPence != null;
    /* A spreadsheet row can carry legs too: some exports put a treble out
       as one row with its selections in a single cell, and the parser
       splits them. */
    const legs = cleanLegs(b.legs);
    await sql`
      INSERT INTO bets (user_id, event, selection, market, bookmaker, odds, stake_pence,
                        profit_pence, outcome, status, placed_at, settled_at, source,
                        bet_type, legs)
      VALUES (${user.id}, ${str(b.event)}, ${str(b.selection)}, ${str(b.market)},
              ${str(bookName(b.book))}, ${b.odds == null ? null : Number(b.odds)},
              ${Math.round(Number(b.stakePence))},
              ${settled ? Math.round(Number(b.profitPence)) : null},
              ${settled ? importOutcome(b) : null},
              ${settled ? 'settled' : 'pending'},
              ${b.placedAt ? new Date(b.placedAt) : new Date()},
              ${settled ? new Date(b.placedAt || Date.now()) : null},
              'import',
              ${betTypeOf(b.betType, legs)}, ${legs ? JSON.stringify(legs) : null})`;
    inserted++;
  }
  /* Everything the summary has to show, reconciled here rather than counted
     again in the browser: detected, imported, skipped as duplicate, and
     rejected with the line and the reason. */
  return json(res, 201, {
    imported: inserted,
    detected: rows.length,
    duplicates: duplicates.length,
    duplicateRows: duplicates.slice(0, 40),
    rejected
  });
}

/* A CSV says "cashed out" without saying whether it made money. The six
   ledger outcomes distinguish those, so the profit decides which one. */
function importOutcome(b) {
  if (b.outcome === 'cash') return cashOutcome(b.profitPence);
  return ['won', 'lost', 'void'].includes(b.outcome) ? b.outcome : null;
}

/* ---------------- settle by hand / cash out ---------------- */
async function update(res, user, body) {
  if (!body || !body.id) return json(res, 400, { error: 'Which bet?' });
  const sql = db();
  const found = await sql`
    SELECT id, odds, stake_pence FROM bets
    WHERE id = ${body.id} AND user_id = ${user.id}`;
  if (!found.length) return json(res, 404, { error: 'That bet is not in your ledger.' });
  const bet = found[0];

  let outcome, profit;
  if (body.kind === 'cash') {
    /* Cash out. The user tells us what they actually took, and the outcome
       follows from that against the stake, cash-profit, cash-loss or
       cash-flat. It is never inferred from a result. */
    const returned = Math.round(Number(body.returnedPence));
    if (!Number.isFinite(returned) || returned < 0) {
      return json(res, 400, { error: 'What did the cash out return?' });
    }
    profit = returned - bet.stake_pence;
    outcome = cashOutcome(profit);
  } else if (body.kind === 'won' || body.kind === 'lost' || body.kind === 'void') {
    if (bet.odds == null) return json(res, 400, { error: 'That bet has no odds to settle against.' });
    /* payoutFor returns the total RETURNED, stake included, profit is the
       difference. Going through the engine rather than reimplementing the
       arithmetic is the point: a hand-settled bet and an auto-settled one
       cannot then disagree by a penny. */
    const payout = payoutFor(body.kind, bet.stake_pence, Number(bet.odds));
    profit = payout - bet.stake_pence;
    outcome = ledgerOutcome(body.kind) || body.kind;
  } else {
    return json(res, 400, { error: 'Unknown settlement.' });
  }

  const rows = await sql`
    UPDATE bets SET status = 'settled', outcome = ${outcome}, profit_pence = ${profit},
                    settled_at = now(), settle_reason = 'Settled by you'
    WHERE id = ${bet.id} AND user_id = ${user.id}
    RETURNING id, event, selection, market, bookmaker, odds, stake_pence,
              profit_pence, outcome, status, placed_at, settled_at, settle_reason, source`;
  return json(res, 200, { bet: shape(rows[0]) });
}

/* ---------------- delete ---------------- */
async function remove(res, user, body) {
  /* Reset everything.
     This button existed and did nothing: it printed "Reset all bets
     completed", disabled itself, and deleted not one row. Somebody
     clearing their record before handing a phone to a friend was told it
     had worked. A destructive control that lies is worse than one that is
     missing, because the missing one does not get trusted.

     `all: true` is required rather than inferred from a missing id, so a
     malformed single delete cannot wipe a ledger. */
  if (body && body.all === true) {
    const sql = db();
    const rows = await sql`DELETE FROM bets WHERE user_id = ${user.id} RETURNING id`;
    /* Slip images go with them. They are the most sensitive thing stored
       and the retention promise is explicit, so "reset my bets" leaving
       the pictures behind would break it. */
    await sql`DELETE FROM slips WHERE user_id = ${user.id}`;
    await sql`DELETE FROM slip_drafts WHERE user_id = ${user.id}`;
    return json(res, 200, { deleted: rows.length, all: true });
  }

  if (!body || !body.id) return json(res, 400, { error: 'Which bet?' });
  const sql = db();
  const rows = await sql`
    DELETE FROM bets WHERE id = ${body.id} AND user_id = ${user.id} RETURNING id`;
  if (!rows.length) return json(res, 404, { error: 'That bet is not in your ledger.' });
  return json(res, 200, { deleted: rows[0].id });
}

/* Where the bet was in its life when it was captured.
 *
 * Taken from what the reader saw on the slip, never inferred from whether a
 * result happened to be present: every slip prints a potential return, and
 * "settled" guessed from that would mark honest prematch captures as
 * after-the-fact. Unknown stays null, and null is excluded from the rate
 * rather than counted either way. */
const CAPTURE_STAGES = ['prematch', 'inplay', 'settled'];
/* THE TYPE IS NEVER TAKEN ON TRUST WHEN THE LEGS DISAGREE WITH IT.
 *
 * A client can send anything. What decides is the shape of what arrived:
 * no legs is a single whatever the body claims, and legs with an
 * unrecognised type are classified from the fixtures they name, which is
 * the same rule the reader uses. Legs in one fixture are a bet builder and
 * never auto-grade; legs across fixtures are an accumulator. */
function betTypeOf(claimed, legs) {
  if (!legs || legs.length < 2) return null;
  const t = String(claimed || '').toLowerCase();
  if (BET_TYPES.includes(t) && isMulti(t)) return t;
  return inferBetType(legs) || 'multiple';
}

function captureStage(body) {
  const v = String((body && body.stage) || '').toLowerCase();
  return CAPTURE_STAGES.includes(v) ? v : null;
}

/* ---------------- validation ----------------
   The rules themselves live in src/js/betshape.js, imported by the browser
   too, so the import review rejects exactly what this route rejects and
   the two cannot drift. Re-exported because callers and tests have always
   asked api/bets.js what a bad bet looks like. */
export { betProblem };

const str = v => (v == null ? null : String(v).trim().slice(0, 200) || null);
