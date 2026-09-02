/** The example account.
 *
 *  Deterministic, seeded, and built THROUGH the event model rather than
 *  beside it: every figure this account shows is folded by recompute(), the
 *  same function production uses, so the demo cannot drift from the product.
 *
 *  It is labelled everywhere it appears. Nothing here is presented as a real
 *  person's record, and no number here is used as social proof. */

import { recompute, turnoverPence } from '@/lib/domain/fold';
import type {
  Bet, BetLeg, BetState, Currency, SettlementEvent, SportId,
} from '@/lib/domain/types';
import type { Movement } from '@/lib/domain/movements';
import type { SlipImage } from '@/lib/domain/slip';
import type { Balance } from '@/lib/domain/balances';
import { ALL_BOOKMAKERS } from './reference';
import { NOTIFICATIONS, SHARING_SWITCHES, switchDefaults } from './settings';
import { DEFAULT_TZ } from '@/lib/format';

// ------------------------------------------------------------------- rng
function mulberry32(a: number) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOTBALL = [
  ['Arsenal', 'Brentford', 'Premier League'], ['Liverpool', 'Everton', 'Premier League'],
  ['Newcastle', 'Brighton', 'Premier League'], ['Aston Villa', 'Fulham', 'Premier League'],
  ['Leeds', 'Norwich', 'Championship'], ['Sunderland', 'Middlesbrough', 'Championship'],
  ['Shamrock Rovers', 'Bohemians', 'League of Ireland'], ['Derry City', 'Shelbourne', 'League of Ireland'],
  ['Celtic', 'Hibernian', 'Scottish Premiership'], ['Rangers', 'Aberdeen', 'Scottish Premiership'],
  ['Napoli', 'Roma', 'Serie A'], ['Real Sociedad', 'Girona', 'La Liga'],
  ['Inter', 'Atalanta', 'Champions League'], ['Dortmund', 'PSV', 'Champions League'],
];

const TENNIS = [
  ['Alcaraz', 'Rune', 'ATP Tour'], ['Sinner', 'Medvedev', 'ATP Tour'],
  ['Swiatek', 'Sabalenka', 'WTA Tour'], ['Draper', 'Fritz', 'ATP Tour'],
  ['Boulter', 'Kasatkina', 'WTA Tour'], ['Norrie', 'Tiafoe', 'Challenger'],
];

const HORSES = [
  ['Constitution Hill', 'Cheltenham', '14:30 Cheltenham'],
  ['Galopin Des Champs', 'Leopardstown', '15:05 Leopardstown'],
  ['Fastorslow', 'Punchestown', '16:10 Punchestown'],
  ['State Man', 'Aintree', '13:45 Aintree'],
  ['Jonbon', 'Ascot', '14:05 Ascot'],
  ['Ballyburn', 'Curragh', '15:40 Curragh'],
  ['Lossiemouth', 'Newmarket', '16:25 Newmarket'],
];

const FOOTBALL_MARKETS = [
  'Match result', 'Over 2.5 goals', 'Under 3.5 goals', 'Both teams to score',
  'Asian handicap -1', 'Over 2.25 goals', 'Double chance 1X', 'Over 1.5 goals',
];
const TENNIS_MARKETS = ['Match result', 'Set betting 2-0', 'Over 21.5 games', 'Game handicap -3.5'];
const HORSE_MARKETS = ['Win', 'Each way'];

const TIPSTERS = [
  { id: 'own', name: 'My own' },
  { id: 'coupon-club', name: 'Coupon Club' },
  { id: 'value-tips', name: 'Value Tips' },
  { id: 'the-rails', name: 'The Rails' },
];

const BOOKS = ['bet365', 'sky-bet', 'paddy-power', 'william-hill', 'betfair-exchange', 'coral', 'boylesports', 'shop'];

export type DemoBet = Bet & {
  state: BetState;
  events: SettlementEvent[];
  /** The stored slip image, when the repository resolved one.
   *
   *  UNDEFINED HERE ON PURPOSE. The example account is generated and has no
   *  images, and undefined means "nobody looked", which is what
   *  lib/domain/slip.ts falls back on. A real account's book carries null for
   *  a bet with no image kept and a row for one that has, and the difference
   *  is the whole reason "Image held" stopped being printed over a file that
   *  did not exist. */
  slipImage?: SlipImage;
};

export type DemoData = {
  account: {
    id: string; displayName: string; handle: string; email: string;
    unitPence: number; currency: Currency; balanceStartPence: number;
    timeZone: string;
    weekStart: 0 | 1; oddsFormat: 'decimal' | 'fractional' | 'american';
    showProfitIn: 'currency' | 'units' | 'both';
    calendarDates: boolean;
    theme: string;
    linkCode: string;
    /** A Telegram chat is linked to this account. */
    telegramLinked: boolean;
    planState: 'trial' | 'active' | 'read_only';
    trialEndsAt: string; trialSlipsAllowed: number; trialSlipsUsed: number;
    /** What the notification and sharing switches are set to. Resolved from
     *  the one list in lib/data/settings.ts against whatever the account has
     *  overridden, so a pane never holds the only copy of an answer. */
    notifications: Record<string, boolean>;
    sharing: Record<string, boolean>;
    /** A break is on. It comes from break_until on the account, and the
     *  switch used to start at false whatever the account said. */
    onBreak: boolean;
  };
  /** Every balance on the account, in the order they are drawn.
   *
   *  The example account keeps three, because one is not an example of
   *  anything: a sterling main bank, a sterling horses bank, and a euro
   *  account with an Irish bookmaker. The third is the one that matters.
   *  Without a second currency in the dataset, nothing on any screen would
   *  demonstrate that two of them never add up, and the rule would be a
   *  sentence in a comment rather than something a reader can see. */
  balances: Balance[];
  /** THE WHOLE BOOK, every balance at once. Pages never see this: the viewer
   *  hands them one balance's bets. Only the balance sheet reads it, and it
   *  splits it by balance before it counts anything. */
  bets: DemoBet[];
  /** Money in and money out. They move the balance and touch no betting
   *  figure at all: see lib/domain/movements.ts. */
  movements: Movement[];
  generatedAt: string;
};

const ACCOUNT_ID = 'demo-account';
const UNIT = 2500;           // £25.00, and every bet freezes the unit it was placed with

/*  THREE BALANCES, AND THE THIRD IS IN EURO.
 *
 *  Which bets land in which is decided from the bet itself rather than from
 *  a draw, for the same reason `asImported` relabels instead of branching: a
 *  single extra rnd() call shifts the whole seeded sequence and quietly
 *  rewrites every figure the example account has ever shown. Horses go to
 *  the horses bank, League of Ireland football to the euro account with the
 *  Irish bookmaker, and everything else to the main one. */
const BAL_MAIN = 'bal-main';
const BAL_HORSES = 'bal-horses';
const BAL_EURO = 'bal-euro';

const balanceIdFor = (bet: Bet): string =>
  (bet.competition === 'League of Ireland' ? BAL_EURO
    : bet.sportId === 'horse-racing' ? BAL_HORSES
      : BAL_MAIN);

/*  A CLOSING PRICE ON SOME OF THEM, AND ON MOST OF THEM NOTHING.
 *
 *  The example account stands in for somebody who looks a closing price up
 *  after the off and types it in, which is what a closing price is: the
 *  product computes none, and this function is not one either. It is the
 *  demo writing down what that person recorded, and it is deliberately
 *  partial, because a dataset where every bet carried one would let a screen
 *  ship that has never been seen with the blank on it. Two bets in five,
 *  singles only: nobody looks up the closing price of a five fold.
 *
 *  Derived from the bet's own id rather than from a draw, for the same
 *  reason `asImported` relabels instead of branching. One extra rnd() call
 *  shifts the whole seeded sequence and rewrites every figure this account
 *  has ever shown. */
function fnv(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const closingFor = (bet: Bet): number | null => {
  if (bet.legs.length > 1) return null;
  const h = fnv(bet.id);
  if (h % 5 >= 2) return null;
  /*  Somewhere between twelve per cent shorter and twelve per cent longer
      than the price taken, which is the range a real book moves over. */
  const swing = ((h >>> 8) % 25) - 12;
  const close = bet.odds / (1 + swing / 100);
  return close > 1.01 ? Number(close.toFixed(2)) : null;
};

function iso(d: Date) { return d.toISOString(); }

/** One deterministic dataset per calendar day, so the demo is stable within a
 *  session and alive across days. */
export function buildDemo(now = new Date()): DemoData {
  const daySeed = Math.floor(now.getTime() / 86400000);
  const rnd = mulberry32(daySeed);
  const bets: DemoBet[] = [];
  let seq = 0;

  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

  const mk = (partial: Partial<Bet> & { id: string; eventAt: string; stakePence: number; odds: number }): Bet => ({
    accountId: ACCOUNT_ID,
    /*  Overwritten by push() from the finished bet. It is here so the
        literal is a whole Bet, not because anything reads it. */
    balanceId: BAL_MAIN,
    closingOdds: null,
    shape: 'single',
    side: 'back',
    liabilityPence: null,
    currency: 'GBP',
    fxRate: null,
    bookmakerId: 'bet365',
    tipsterId: 'own',
    sportId: 'football',
    competition: null,
    course: null,
    eventName: '',
    selection: '',
    marketRaw: 'Match result',
    marketGroupId: null,
    placedAt: partial.eventAt,
    expectedSettleAt: null,
    isFreeBet: false,
    isBonusFunds: false,
    isBoosted: false,
    isEachWay: false,
    ewPlaceFraction: null,
    ewPart: null,
    ewGroupId: null,
    placesPaid: null,
    slipBacked: true,
    source: 'telegram',
    arbGroupId: null,
    note: null,
    unitPenceAtPlacement: UNIT,
    commissionPct: 0,
    createdAt: partial.eventAt,
    legs: [],
    ...partial,
  }) as Bet;

  /** Relabel a finished bet as imported history.
   *
   *  Applied to the object mk() returned rather than written into the
   *  literal, because `imported ? 'csv_import' : rnd() < 0.75 ? ...` never
   *  makes the draw it replaces, and one skipped draw shifts the seeded
   *  sequence and rewrites every figure in the example account. This way the
   *  dataset is the one it always was, with two fields renamed on its oldest
   *  two months. */
  const asImported = (yes: boolean, bet: Bet): Bet =>
    (yes ? { ...bet, source: 'csv_import', slipBacked: false } : bet);

  const ev = (
    betId: string, type: SettlementEvent['type'], occurredAt: string,
    extra: Partial<SettlementEvent> = {},
  ): SettlementEvent => ({
    id: `ev-${++seq}`,
    betId,
    seq: extra.seq ?? 1,
    type,
    fractionEighths: null,
    returnedPence: null,
    deductionPence: null,
    commissionPct: null,
    occurredAt,
    enteredBy: 'system',
    afterResultKnown: false,
    note: null,
    createdAt: occurredAt,
    ...extra,
  });

  const push = (bet: Bet, events: SettlementEvent[]) => {
    /*  THE BALANCE AND ITS CURRENCY, decided from the finished bet.
        A euro balance holds euro bets: the currency is a property of the
        pot the money sits in, so it is written here rather than being one
        more thing every call site above has to remember. */
    const balanceId = balanceIdFor(bet);
    /*  IN PLAY ON ABOUT ONE IN NINE OF THE SINGLES.
     *
     *  There is no isLive column and there should not be: a bet struck after
     *  kick off IS an in play bet, so `placedAt` later than `eventAt` is the
     *  definition rather than a copy of it. See isInPlay in
     *  lib/domain/types.ts. What the demo has to supply is bets where the
     *  two differ, or the analyser's in play axis has one group in it and
     *  the screen has never been seen doing its job. Off the id, not off a
     *  draw, for the reason every other assignment in this file is. */
    const live = bet.legs.length <= 1 && fnv(`live-${bet.id}`) % 9 === 0;
    const placed: Bet = {
      ...bet,
      balanceId,
      currency: balanceId === BAL_EURO ? 'EUR' : 'GBP',
      closingOdds: closingFor(bet),
      placedAt: live ? iso(new Date(Date.parse(bet.eventAt) + 40 * 60000)) : bet.placedAt,
    };
    const state = recompute(placed, events, iso(now));
    bets.push({ ...placed, state, events });
  };

  // ---- 190 days of history ------------------------------------------------
  const DAYS = 186;
  /*  The oldest two months are a spreadsheet somebody brought with them when
   *  they signed up, not bets this product watched happen.
   *
   *  Without them the example account could not show any of the four
   *  surfaces that split on it: the ledger's source chip, the dashboard
   *  sentence that says best day and the streak count only what was placed
   *  here, the export's `imported` column, and the marker on the row. Each of
   *  those was written against a distinction the demo did not contain, which
   *  is a feature nobody can look at.
   *
   *  It relabels bets rather than adding any, and every rnd() draw it
   *  replaces is still made, so the dataset is the same size with the same
   *  figures as before. A skipped draw would shift the whole sequence and
   *  quietly rewrite every number in the demo. */
  const IMPORTED_UNTIL = DAYS - 60;
  let n = 0;

  for (let d = DAYS; d >= 0; d--) {
    // Not every day has bets. Weekends and midweek European nights are busier.
    const date = new Date(now.getTime() - d * 86400000);
    const dow = date.getUTCDay();
    const busy = dow === 6 || dow === 0 || dow === 2 || dow === 3;
    const many = busy ? 1 + Math.floor(rnd() * 4) : rnd() < 0.45 ? 1 + Math.floor(rnd() * 2) : 0;

    for (let k = 0; k < many; k++) {
      n += 1;
      const id = `b${String(n).padStart(4, '0')}`;
      const hour = 12 + Math.floor(rnd() * 9);
      const at = new Date(Date.UTC(
        date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, [0, 15, 30, 45][Math.floor(rnd() * 4)],
      ));
      const running = d <= 1 && rnd() < 0.55;
      const imported = d > IMPORTED_UNTIL;
      const settledToday = d === 0 && !running;

      const sportRoll = rnd();
      const sportId: SportId = sportRoll < 0.62 ? 'football' : sportRoll < 0.82 ? 'horse-racing' : 'tennis';
      const bookmakerId = pick(BOOKS);
      const bookCommission = ALL_BOOKMAKERS.find((b) => b.id === bookmakerId)?.commissionPct ?? 0;
      const tipster = rnd() < 0.62 ? 'own' : pick(TIPSTERS).id;
      const isFree = rnd() < 0.055;
      const isBoost = !isFree && rnd() < 0.07;

      const stakeUnits = pick([0.4, 0.5, 0.8, 1, 1, 1, 1.2, 2, 2, 3, 0.25]);
      const stakePence = Math.round(UNIT * stakeUnits);

      const shapeRoll = rnd();

      // ---------- a multiple ------------------------------------------------
      if (sportId === 'football' && shapeRoll < 0.24) {
        const legCount = shapeRoll < 0.10 ? 2 : shapeRoll < 0.18 ? 3 : 4 + Math.floor(rnd() * 2);
        const legs: BetLeg[] = [];
        for (let i = 0; i < legCount; i++) {
          const f = pick(FOOTBALL);
          const odds = Number((1.25 + rnd() * 1.7).toFixed(2));
          legs.push({
            id: `${id}-l${i + 1}`, betId: id, seq: i + 1,
            selection: rnd() < 0.5 ? f[0] : `Over 2.5 goals`,
            marketRaw: rnd() < 0.5 ? 'Match result' : 'Over 2.5 goals',
            fixtureId: null, eventName: `${f[0]} v ${f[1]}`, legOdds: odds,
            legResult: 'open', eventAt: iso(at),
          });
        }
        const bet = asImported(imported, mk({
          id, eventAt: iso(at), stakePence,
          odds: Number(legs.reduce((a, l) => a * l.legOdds, 1).toFixed(3)),
          shape: 'multi_cross_fixture',
          sportId, bookmakerId, tipsterId: tipster,
          competition: pick(FOOTBALL)[2],
          eventName: `${legCount} fold`,
          selection: legs.map((l) => l.selection).join(' / '),
          marketRaw: 'Accumulator',
          isFreeBet: isFree, isBoosted: isBoost,
          commissionPct: bookCommission,
          source: rnd() < 0.75 ? 'telegram' : 'manual',
          slipBacked: rnd() > 0.12,
          legs,
        }));

        if (running) { push(bet, []); continue; }

        // Grade the legs, then let the multiple fall out of them. This is the
        // path that a previous build wrote, unit tested and never called.
        const graded = legs.map((l) => {
          const r = rnd();
          const res = r < 0.62 ? 'won' : r < 0.94 ? 'lost' : 'void';
          l.legResult = res as BetLeg['legResult'];
          return res;
        });
        const anyLost = graded.includes('lost');
        const events: SettlementEvent[] = [];
        const settleAt = iso(new Date(at.getTime() + 3 * 3600000));
        if (anyLost) {
          events.push(ev(id, 'lost', settleAt));
        } else if (graded.every((g) => g === 'void')) {
          events.push(ev(id, 'void', settleAt));
        } else if (rnd() < 0.12) {
          // A cash out mid multiple. Always a user action.
          const live = legs.filter((l) => l.legResult !== 'void');
          const upto = live.slice(0, Math.max(1, live.length - 1)).reduce((a, l) => a * l.legOdds, 1);
          events.push(ev(id, 'cash_out_full', settleAt, {
            returnedPence: Math.round(stakePence * upto * 0.72),
            enteredBy: 'you',
          }));
        } else {
          events.push(ev(id, 'won', settleAt));
        }
        push(bet, events);
        continue;
      }

      // ---------- horse racing, sometimes each way -------------------------
      if (sportId === 'horse-racing') {
        const h = pick(HORSES);
        const odds = Number((2 + rnd() * 9).toFixed(2));
        const eachWay = rnd() < 0.35;
        const fraction = 0.2;
        const settleAt = iso(new Date(at.getTime() + 40 * 60000));

        if (eachWay) {
          // Two linked parts settling independently, which is what an each
          // way bet actually is. Nothing in the fold needs a special case.
          const groupId = `${id}-ew`;
          const half = Math.round(stakePence / 2);
          const placeOdds = Number((1 + (odds - 1) * fraction).toFixed(3));
          // A fifth the odds is paid on three places in a field this size.
          // Stored beside the fraction because a ledger saying a horse placed
          // has to be able to say what a place was on that race.
          const placesPaid = 3;
          const winPart = asImported(imported, mk({
            id: `${id}w`, eventAt: iso(at), stakePence: half, odds,
            shape: 'each_way', ewPart: 'win', ewGroupId: groupId, isEachWay: true,
            ewPlaceFraction: fraction, placesPaid, sportId, bookmakerId, tipsterId: tipster,
            course: h[1], competition: h[1], eventName: h[2], selection: h[0],
            marketRaw: 'Win', commissionPct: bookCommission, source: 'telegram',
          }));
          const placePart = asImported(imported, mk({
            id: `${id}p`, eventAt: iso(at), stakePence: half, odds: placeOdds,
            shape: 'each_way', ewPart: 'place', ewGroupId: groupId, isEachWay: true,
            ewPlaceFraction: fraction, placesPaid, sportId, bookmakerId, tipsterId: tipster,
            course: h[1], competition: h[1], eventName: h[2], selection: h[0],
            marketRaw: 'Each way place', commissionPct: bookCommission, source: 'telegram',
          }));
          if (running) { push(winPart, []); push(placePart, []); continue; }
          const r = rnd();
          const wonOutright = r < 0.22;
          const placedOnly = !wonOutright && r < 0.52;
          push(winPart, [ev(`${id}w`, wonOutright ? 'won' : 'lost', settleAt)]);
          push(placePart, [ev(`${id}p`, wonOutright || placedOnly ? 'placed' : 'lost', settleAt)]);
          continue;
        }

        const bet = asImported(imported, mk({
          id, eventAt: iso(at), stakePence, odds,
          sportId, bookmakerId, tipsterId: tipster,
          course: h[1], competition: h[1], eventName: h[2], selection: h[0],
          marketRaw: pick(HORSE_MARKETS), isFreeBet: isFree, isBoosted: isBoost,
          commissionPct: bookCommission,
          source: rnd() < 0.6 ? 'telegram' : 'web_upload',
          slipBacked: rnd() > 0.1,
        }));
        if (running) { push(bet, []); continue; }
        const r = rnd();
        const events: SettlementEvent[] = [];
        if (r < 0.26) {
          events.push(ev(id, 'won', settleAt));
          // A Rule 4 lands on about one winner in seven, after the result.
          if (rnd() < 0.14) {
            events.push(ev(id, 'rule4', settleAt, {
              seq: 2, deductionPence: pick([5, 10, 15, 20, 25]),
              enteredBy: 'you', afterResultKnown: true,
              note: 'Non runner withdrawn before the off.',
            }));
          }
        } else if (r < 0.30) {
          events.push(ev(id, 'void', settleAt, { note: 'Non runner.' }));
        } else {
          events.push(ev(id, 'lost', settleAt));
        }
        push(bet, events);
        continue;
      }

      // ---------- a single --------------------------------------------------
      const isTennis = sportId === 'tennis';
      const f = isTennis ? pick(TENNIS) : pick(FOOTBALL);
      const market = isTennis ? pick(TENNIS_MARKETS) : pick(FOOTBALL_MARKETS);
      const odds = Number((1.35 + rnd() * 2.9).toFixed(2));
      const lay = !isTennis && rnd() < 0.05;
      const settleAt = iso(new Date(at.getTime() + 2 * 3600000));

      const bet = asImported(imported, mk({
        id, eventAt: iso(at), stakePence, odds,
        side: lay ? 'lay' : 'back',
        liabilityPence: lay ? Math.round(stakePence * (odds - 1)) : null,
        sportId, bookmakerId: lay ? 'betfair-exchange' : bookmakerId,
        tipsterId: tipster,
        competition: f[2], eventName: `${f[0]} v ${f[1]}`,
        selection: rnd() < 0.5 ? f[0] : f[1],
        marketRaw: market,
        isFreeBet: isFree, isBoosted: isBoost,
        commissionPct: lay ? 2 : bookCommission,
        source: rnd() < 0.7 ? 'telegram' : rnd() < 0.5 ? 'manual' : 'web_upload',
        slipBacked: rnd() > 0.14,
      }));

      if (running) { push(bet, []); continue; }

      const r = rnd();
      const events: SettlementEvent[] = [];
      if (market.includes('2.25')) {
        // A quarter line splits the stake, which is exactly the case a single
        // result column cannot hold.
        events.push(ev(id, r < 0.5 ? 'half_won' : 'half_lost', settleAt));
      } else if (r < 0.44) {
        events.push(ev(id, 'won', settleAt));
        if (lay || bet.commissionPct > 0) {
          events.push(ev(id, 'commission', settleAt, { seq: 2, commissionPct: bet.commissionPct }));
        }
      } else if (r < 0.48) {
        events.push(ev(id, 'void', settleAt, { note: 'Fixture postponed.' }));
      } else if (r < 0.53) {
        // Two consecutive partial cash outs, in eighths of what remains.
        const first = Math.round((stakePence * 4) / 8);
        events.push(ev(id, 'cash_out_partial', settleAt, {
          seq: 1, fractionEighths: 4, returnedPence: Math.round(first * (1 + (odds - 1) * 0.55)),
          enteredBy: 'you',
        }));
        const rest = stakePence - first;
        events.push(ev(id, 'cash_out_partial', settleAt, {
          seq: 2, fractionEighths: 4, returnedPence: Math.round(rest * (1 + (odds - 1) * 0.3)),
          enteredBy: 'you',
        }));
      } else if (r < 0.56 && settledToday) {
        events.push(ev(id, 'cash_out_full', settleAt, {
          returnedPence: Math.round(stakePence * (0.6 + rnd() * 1.1)), enteredBy: 'you',
        }));
      } else {
        events.push(ev(id, 'lost', settleAt));
      }
      push(bet, events);
    }
  }

  /*  MONEY IN AND MONEY OUT, which is not profit and is never counted as it.
   *
   *  Built after the bets and from its own draws at the END of the seeded
   *  sequence, so adding them cannot shift a single figure the example
   *  account showed before: every rnd() call the bets make is still made in
   *  the same order.
   *
   *  A top up at the start of a month and an occasional withdrawal is what
   *  the pattern actually looks like, and the account has to show both or the
   *  ledger's two row shapes cannot be told apart on the example. */
  const movements: Movement[] = [];
  const mv = (
    kind: Movement['kind'], daysAgo: number, amountMinor: number,
    note: string | null, bookmakerId: string | null, balanceId = BAL_MAIN,
  ): void => {
    movements.push({
      id: `mv-${movements.length + 1}`,
      accountId: ACCOUNT_ID,
      balanceId,
      kind,
      amountMinor,
      /*  A movement takes its balance's currency, never the account's.
          Money paid into the euro account is not money in the sterling one,
          and nothing anywhere adds the two. */
      currency: balanceId === BAL_EURO ? 'EUR' : 'GBP',
      bookmakerId,
      occurredAt: iso(new Date(now.getTime() - daysAgo * 86400000 + 11 * 3600000)),
      note,
      createdAt: iso(new Date(now.getTime() - daysAgo * 86400000 + 11 * 3600000)),
    });
  };

  for (let d = 180; d >= 0; d -= 30) {
    mv('deposit', d, 20000 + Math.round(rnd() * 6) * 5000, 'Monthly top up', pick(BOOKS.filter((b) => b !== 'shop')));
  }
  mv('withdrawal', 74, 15000, 'Took a good week out', 'bet365');
  mv('withdrawal', 21, 25000, null, 'paddy-power');

  /*  The other two balances, with their own money in and out, appended after
      the loop above and with no draws of their own so the sequence the bets
      were built from is untouched. A balance whose only movement is its
      starting figure cannot show a running balance, and the ledger's two row
      shapes would be untestable on two of the three. */
  mv('deposit', 150, 40000, 'Opened the horses bank', 'boylesports', BAL_HORSES);
  mv('deposit', 62, 20000, 'Cheltenham float', 'boylesports', BAL_HORSES);
  mv('withdrawal', 30, 12500, null, 'boylesports', BAL_HORSES);
  mv('deposit', 140, 30000, 'Opened the euro account', 'paddy-power', BAL_EURO);
  mv('deposit', 45, 15000, null, 'paddy-power', BAL_EURO);
  movements.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const trialEnds = new Date(now.getTime() + 9 * 86400000);

  const bal = (
    id: string, name: string, currency: Currency, startMinor: number,
    sort: number, shareToken: string | null,
  ): Balance => ({
    id, accountId: ACCOUNT_ID, name, currency, startMinor,
    unitMinor: UNIT, shareToken, archived: false, sort,
    createdAt: iso(new Date(now.getTime() - 190 * 86400000)),
  });

  return {
    /*  One of the three is shared and two are not, because the read only
        page and the control that revokes it are both worth being able to
        look at. The token is a fixed string here for the same reason every
        other figure in this dataset is: an example account that changes
        under you is not an example. */
    balances: [
      bal(BAL_MAIN, 'Main', 'GBP', 100000, 0, 'sb-k4qmw92xr3fzhn5tvbdc'),
      bal(BAL_HORSES, 'Horses', 'GBP', 40000, 1, null),
      bal(BAL_EURO, 'Euro account', 'EUR', 30000, 2, null),
    ],
    account: {
      id: ACCOUNT_ID,
      displayName: 'Tester',
      handle: 'tester123',
      email: 'tester@example.com',
      unitPence: UNIT,
      currency: 'GBP',
      /*  SUPERSEDED BY THE BALANCE'S OWN FIGURE, and kept because the
          settings pane still edits an account level starting figure for an
          account that has never made a second balance. Every screen reads
          the selected balance's startMinor: see lib/data/session.ts. */
      balanceStartPence: 100000,
      timeZone: DEFAULT_TZ,
      weekStart: 1,
      oddsFormat: 'decimal',
      showProfitIn: 'both',
      calendarDates: true,
      theme: 'carbon',
      linkCode: 'SLIP-7QK4',
      telegramLinked: true,
      planState: 'trial',
      trialEndsAt: iso(trialEnds),
      trialSlipsAllowed: 35,
      trialSlipsUsed: 12,
      notifications: switchDefaults(NOTIFICATIONS, null),
      sharing: switchDefaults(SHARING_SWITCHES, null),
      onBreak: false,
    },
    bets,
    movements,
    generatedAt: iso(now),
  };
}

/** Cached per process. The dataset is a pure function of the calendar day, so
 *  a cache key of that day is exact. */
let cache: { key: number; data: DemoData } | null = null;

export function demoData(now = new Date()): DemoData {
  const key = Math.floor(now.getTime() / 86400000);
  if (cache && cache.key === key) return cache.data;
  const data = buildDemo(now);
  cache = { key, data };
  return data;
}

export { turnoverPence };
