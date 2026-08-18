/* =========================================================================
   SETTLEMENT ENGINE

   Turns a selection from a slip plus a fixture result into a settled
   outcome, or an honest "ask the user" when it cannot be certain.

   Rule everything follows: A WRONG GRADE IS WORSE THAN NO GRADE.
   Every unknown path returns {status:'ask'}. Nothing is guessed.

   Handles
     - 90 minute settlement, never counting extra time or penalties
     - Asian vs European handicaps, per bookmaker
     - whole lines push, quarter lines split the stake
     - postponed, cancelled, abandoned and interrupted fixtures
     - accumulators and bet builders, with void legs dropping out

   PURITY CONTRACT
   This module is imported by both the browser bundle and the serverless
   functions. It must stay free of DOM access, globals, I/O and clock reads.
   Money is integer pence throughout. Never floats.
   ====================================================================== */

import { sportOf, HORSES_REASON } from './sports.js';
import { BOOKMAKERS, bookKey } from './books.js';
/* Re-exported because the graders and the tests have always asked
   settlement.js how a bookmaker name folds. The answer now lives in the
   registry; this is where callers still look for it. */
export { bookKey };

/* ---- how each bookmaker settles.
   Asian: a whole-number handicap can push and the stake comes back.
   European (3 way): the same scoreline is a loss, because the handicap
   draw is a separate outcome. So -1 behaves like -1.5 for the backer.

   Derived from the registry in books.js, so adding a bookmaker is one row
   in one file rather than four edits nothing checks. Keys are compared
   case-insensitively and with punctuation stripped, and every alias
   resolves too, because slips spell them inconsistently ("bet365",
   "Bet 365", "BET365"). ---- */
export const BOOK_RULES = Object.fromEntries(
  BOOKMAKERS.map(b => [bookKey(b.id), { handicap: b.handicap }]));
/* Aliases resolve too, so a slip that says "Bet 365" grades on the Asian
   table rather than falling through to the European default. */
for (const b of BOOKMAKERS) {
  BOOK_RULES[bookKey(b.name)] = { handicap: b.handicap };
  for (const a of b.aliases || []) BOOK_RULES[bookKey(a)] = { handicap: b.handicap };
}
export const DEFAULT_RULES = { handicap: 'european' };

export function rulesFor(book) {
  return BOOK_RULES[bookKey(book)] || DEFAULT_RULES;
}

/* Aggressive normaliser for market matching. Strips filler words that
   appear on slips but carry no meaning for grading. */
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\bgoals?\b/g, '')
    .replace(/\btotal\b/g, '')
    .replace(/\bmatch\b/g, '')
    .replace(/\bfull ?time\b/g, '')
    .replace(/\bft\b/g, '')
    .replace(/[–—_,]/g, ' ')
    .replace(/-(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Light touch: lowercase and collapse spaces only. The aggressive norm()
   strips words like "match" and "goal", which would hide phrases such as
   "rest of match" and "next goal" from the guard below. */
export function soft(s) {
  return String(s || '').toLowerCase().replace(/[–—_,]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function teamKey(s) {
  return String(s || '').toLowerCase()
    .replace(/\b(fc|afc|cf|sk|if|ff|bk|sc|ac|as|us|ss|club|team)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function sameTeam(a, b) {
  const x = teamKey(a), y = teamKey(b);
  if (!x || !y) return false;
  /* Require a meaningful stem before allowing prefix matching, or short
     fragments like "as" collapse to "" and match everything. */
  if (x === y) return true;
  if (x.length < 3 || y.length < 3) return false;
  return x.indexOf(y) === 0 || y.indexOf(x) === 0;
}
export function sideOf(text, fx) {
  const t = norm(text);
  if (/\b(home|host)\b/.test(t)) return 'home';
  if (/\b(away|visitor)\b/.test(t)) return 'away';
  if (sameTeam(t, fx.home)) return 'home';
  if (sameTeam(t, fx.away)) return 'away';
  const w = t.split(' ');
  for (let n = w.length; n >= 1; n--) {
    for (let i = 0; i + n <= w.length; i++) {
      const frag = w.slice(i, i + n).join(' ');
      if (frag.length < 3) continue;
      if (sameTeam(frag, fx.home)) return 'home';
      if (sameTeam(frag, fx.away)) return 'away';
    }
  }
  return null;
}

/* Markets a score-only feed cannot resolve. Recognised on purpose so we
   defer rather than fail. The last group is in-play specific: they cover
   part of a match, not the whole thing. */
export const NEEDS_MORE = [
  /\banytime\b/, /\bfirst (goal ?)?scorer\b/, /\blast (goal ?)?scorer\b/,
  /\bto score\b/, /\bshots?\b/, /\bassists?\b/, /\bcards?\b/, /\bbooking/,
  /\bcorners?\b/, /\boffsides?\b/, /\bfouls?\b/, /\bsaves?\b/, /\btackles?\b/,
  /\bpasses\b/, /\bplayer\b/, /\bhat ?trick\b/, /\bbrace\b/,
  /\brest of (the )?(match|game)\b/, /\bnext goal\b/, /\bremaining\b/,
  /\bfrom now\b/, /\bin the next\b/, /\brace to\b/,
  /\bbet ?builder\b/, /\bsame game\b/, /\bsgm\b/, /\bscorecast\b/,
  /\bwincast\b/, /\bmethod of\b/, /\bpenalty\b/, /\bvar\b/,
  /\bwinning margin\b/, /\bhalf ?time\/full ?time\b/, /\bht\/ft\b/
];

/* `market` is the bookmaker's own label for the bet, when the slip carried
   one. It is a hint, never an override: the selection text still has to
   name a side and a line, and anything that cannot be read is still
   refused. It exists because of the handicap case below. */
export function parseSelection(raw, fx, market) {
  const t = norm(raw), st = soft(raw);
  const mk = norm(market || '');
  let m, side;
  if (!t) return null;

  /* BTTS first: the phrase contains "to score" which the guard below catches */
  if (/\bbtts\b|\bboth teams? to score\b|\bgg\/ng\b/.test(t)) {
    if (/\b(no|ng)\b/.test(t)) return { market: 'btts', side: 'no' };
    if (/\b(yes|gg)\b/.test(t)) return { market: 'btts', side: 'yes' };
    return null;
  }
  for (let k = 0; k < NEEDS_MORE.length; k++) {
    if (NEEDS_MORE[k].test(t) || NEEDS_MORE[k].test(st)) return { market: 'needs_more' };
  }

  m = t.match(/\b(over|under|o|u)\s*(\d+(?:\.\d+)?)\b/);
  if (m) {
    const dir = m[1][0] === 'o' ? 'over' : 'under';
    const line = parseFloat(m[2]);
    side = sideOf(t.replace(m[0], ' '), fx);
    if (/\b(1st|first|2nd|second) half\b|\bhalf ?time\b|\bht\b/.test(t)) {
      return { market: 'ou_half', dir, line,
               half: /\b(2nd|second)\b/.test(t) ? 2 : 1, side };
    }
    return { market: side ? 'ou_team' : 'ou', dir, line, side };
  }

  m = t.match(/\b(?:correct score\s*)?(\d+)\s*[-:x]\s*(\d+)\b/);
  if (m && /correct score|\bcs\b/.test(t)) {
    return { market: 'correct_score', hg: +m[1], ag: +m[2] };
  }

  /* HANDICAPS.
   *
   * These three patterns all require the word "handicap", "hcp" or "ah", or
   * brackets. Bookmakers do not print it that way. Every slip this codebase
   * has seen prints "Arsenal -1" or "Bayern Munich -1.5", the team then a
   * signed number, and none of those matched: measured against a live feed,
   * 9 handicap bets out of 300 parsed and the other 291 came back "could
   * not read this market with confidence". Refusing is safe, but refusing
   * the normal form of the commonest handicap bet is not useful.
   *
   * The fourth pattern reads the bare form. It is guarded so it cannot
   * swallow an over/under line, which is the one thing nearby that also
   * ends in a number:
   *   · the number must carry an explicit + or -, and a total never does
   *     ("Over 2.5", not "Over +2.5"); and
   *   · sideOf must find one of the two teams in the text, which a totals
   *     selection has no reason to name.
   * The bookmaker's market label counts as corroboration when the slip
   * gave us one, but it is never enough on its own. */
  m = t.match(/([+-]?\d+(?:\.\d+)?)\s*(?:goal)?\s*(?:handicap|hcp|ah)\b/) ||
      t.match(/\b(?:handicap|hcp|ah)\s*([+-]?\d+(?:\.\d+)?)/) ||
      t.match(/\(([+-]\d+(?:\.\d+)?)\)/);
  if (!m && (/\bhandicap|\bhcp\b|\bah\b|\bspread\b/.test(mk) || /[+-]\d/.test(t))) {
    const bare = t.match(/(?:^|[^\d.])([+-]\d+(?:\.\d+)?)\s*$/);
    if (bare) m = bare;
  }
  if (m) {
    side = sideOf(t, fx);
    if (!side) return null;
    return { market: 'handicap', side, line: parseFloat(m[1]) };
  }

  if (/\bdraw no bet\b|\bdnb\b/.test(t)) {
    side = sideOf(t.replace(/draw no bet|dnb/g, ' '), fx);
    return side ? { market: 'dnb', side } : null;
  }

  if (/\bdouble chance\b|\b1x\b|\bx2\b|\b12\b|\bor draw\b/.test(t)) {
    if (/\b1x\b/.test(t)) return { market: 'dc', side: 'hd' };
    if (/\bx2\b/.test(t)) return { market: 'dc', side: 'ad' };
    if (/\b12\b/.test(t)) return { market: 'dc', side: 'ha' };
    side = sideOf(t.replace(/or draw|double chance/g, ' '), fx);
    if (side === 'home') return { market: 'dc', side: 'hd' };
    if (side === 'away') return { market: 'dc', side: 'ad' };
    return null;
  }

  if (/\bclean sheet\b/.test(t)) {
    side = sideOf(t.replace(/clean sheet|yes|no/g, ' '), fx);
    if (!side) return null;
    return { market: 'clean_sheet', side, want: /\bno\b/.test(t) ? 'no' : 'yes' };
  }
  if (/\bwin to nil\b|\bwtn\b/.test(t)) {
    side = sideOf(t.replace(/win to nil|wtn/g, ' '), fx);
    return side ? { market: 'win_to_nil', side } : null;
  }

  if (/\bdraw\b|^x$/.test(t) && !/\bno bet\b|\bor\b/.test(t)) {
    return { market: '1x2', side: 'draw' };
  }
  if (/^1$/.test(t)) return { market: '1x2', side: 'home' };
  if (/^2$/.test(t)) return { market: '1x2', side: 'away' };
  side = sideOf(t.replace(/\bto win\b|\bwin\b|\bresult\b/g, ' '), fx);
  if (side && /^(home|away|[a-z0-9 ().]+)( to win| win)?$/.test(t)) {
    return { market: '1x2', side };
  }
  return null;
}

export const WON = 'won', LOST = 'lost', VOID = 'void',
             HALF_WON = 'half_won', HALF_LOST = 'half_lost';

export function isQuarter(line) {
  const f = Math.abs(line % 1);
  return Math.abs(f - 0.25) < 1e-9 || Math.abs(f - 0.75) < 1e-9;
}
export function vsLine(value, line) {
  if (isQuarter(line)) {
    const a = vsLine(value, line - 0.25), b = vsLine(value, line + 0.25);
    if (a === WON && b === WON) return WON;
    if (a === LOST && b === LOST) return LOST;
    if (a === WON && b === VOID) return HALF_WON;
    if (a === VOID && b === LOST) return HALF_LOST;
    return VOID;
  }
  const d = value - line;
  if (Math.abs(d) < 1e-9) return VOID;
  return d > 0 ? WON : LOST;
}
export function flip(r) {
  return r === WON ? LOST : r === LOST ? WON
       : r === HALF_WON ? HALF_LOST : r === HALF_LOST ? HALF_WON : VOID;
}

export function gradeMarket(p, fx, book) {
  if (!p || p.market === 'needs_more') return null;
  const hg = fx.hg, ag = fx.ag, total = hg + ag;
  let r, v;

  switch (p.market) {
    case '1x2':
      if (p.side === 'home') return hg > ag ? WON : LOST;
      if (p.side === 'away') return ag > hg ? WON : LOST;
      return hg === ag ? WON : LOST;
    case 'dc':
      if (p.side === 'hd') return hg >= ag ? WON : LOST;
      if (p.side === 'ad') return ag >= hg ? WON : LOST;
      return hg !== ag ? WON : LOST;
    case 'dnb':
      if (hg === ag) return VOID;
      return (p.side === 'home' ? hg > ag : ag > hg) ? WON : LOST;
    case 'btts': {
      const both = hg > 0 && ag > 0;
      return (p.side === 'yes' ? both : !both) ? WON : LOST;
    }
    case 'ou':
      r = vsLine(total, p.line);
      return p.dir === 'over' ? r : flip(r);
    case 'ou_team':
      v = p.side === 'home' ? hg : ag;
      r = vsLine(v, p.line);
      return p.dir === 'over' ? r : flip(r);
    case 'ou_half': {
      if (fx.hth === undefined || fx.hta === undefined) return null;
      if (p.half === 1) v = p.side ? (p.side === 'home' ? fx.hth : fx.hta) : fx.hth + fx.hta;
      else v = p.side ? (p.side === 'home' ? hg - fx.hth : ag - fx.hta)
                      : (hg - fx.hth) + (ag - fx.hta);
      r = vsLine(v, p.line);
      return p.dir === 'over' ? r : flip(r);
    }
    case 'handicap': {
      const margin = (p.side === 'home' ? hg - ag : ag - hg) + p.line;
      r = vsLine(margin, 0);
      /* European handicaps do not push. The handicap draw is its own
         outcome, so backing either side on that scoreline loses. This is
         why a -1 behaves like a -1.5 everywhere except bet365. */
      if (r === VOID && rulesFor(book).handicap === 'european') return LOST;
      return r;
    }
    case 'correct_score':
      return (hg === p.hg && ag === p.ag) ? WON : LOST;
    case 'clean_sheet': {
      const kept = (p.side === 'home' ? ag : hg) === 0;
      return (p.want === 'yes' ? kept : !kept) ? WON : LOST;
    }
    case 'win_to_nil':
      return (p.side === 'home' ? (hg > ag && ag === 0) : (ag > hg && hg === 0)) ? WON : LOST;
    default:
      return null;
  }
}

/* Money is integer pence. Bankers-free, half-up rounding, applied once at
   the payout boundary so a long ledger cannot drift. */
export function roundPence(n) { return Math.round(n + (n >= 0 ? 1e-9 : -1e-9)); }

export function payoutFor(result, stakePence, odds) {
  switch (result) {
    case WON:       return roundPence(stakePence * odds);
    case LOST:      return 0;
    case VOID:      return stakePence;
    /* Half the stake rides at full odds, half comes straight back. */
    case HALF_WON:  return roundPence(stakePence / 2 * odds) + roundPence(stakePence / 2);
    case HALF_LOST: return roundPence(stakePence / 2);
    default:        return null;
  }
}

/* The six ledger outcomes. cash-* is reserved for a user cash-out action
   and is never produced by the grader: a feed cannot detect a cash out.
   A half win is a win at reduced profit; a half loss is a loss at reduced
   cost. Filing either as a cash out would corrupt the one category that
   must only ever come from the user. */
export function ledgerOutcome(result, profitPence) {
  switch (result) {
    case WON:       return 'won';
    case HALF_WON:  return 'won';
    case LOST:      return 'lost';
    case HALF_LOST: return 'lost';
    case VOID:      return 'void';
    default:        return null;
  }
}
export function cashOutcome(profitPence) {
  return profitPence > 0 ? 'cash-profit' : profitPence < 0 ? 'cash-loss' : 'cash-flat';
}

export const FINISHED  = { FT: 1, 'MATCH FINISHED': 1, FINISHED: 1, 'FULL TIME': 1 };
export const EXTRA     = { AET: 1, PEN: 1, FT_PEN: 1, 'AFTER ET': 1, PENALTIES: 1,
                           'AFTER EXTRA TIME': 1, 'PENALTY SHOOTOUT': 1 };
export const DEAD_VOID = { POSTPONED: 1, CANCELLED: 1, CANCELED: 1, WO: 1, AWARDED: 1 };
export const DEAD_ASK  = { ABANDONED: 1, INTERRUPTED: 1, SUSPENDED: 1 };
/* Finished, but the feed cannot prove the 90-minute score.
 *
 * FlashScore reports this for cup ties: the match is over, and the score it
 * publishes may include extra time it did not break out. Settling on that
 * would break the one rule this file exists for.
 *
 * It used to fall through to `pending`, which is the wrong kind of safe.
 * Pending means "still running" everywhere it is shown, so a finished cup
 * tie sat in the running list forever and the user was never told it needed
 * them. Over a three day window that was 274 of 1291 fixtures. Asking is
 * the honest answer: the bet is over, we will not guess it, you decide. */
export const FINISHED_UNPROVABLE = { FINISHED_UNKNOWN: 1, 'FINISHED UNKNOWN': 1 };

/* Extra time never counts unless the market says so. If the feed gives an
   explicit 90 minute score we use it. If it does not, we hand the bet to
   the user rather than settling on a score that includes extra time. */
export function ninetyMinute(fx) {
  if (typeof fx.ft90h === 'number' && typeof fx.ft90a === 'number') {
    return { hg: fx.ft90h, ag: fx.ft90a, hth: fx.hth, hta: fx.hta,
             home: fx.home, away: fx.away, status: 'FT' };
  }
  return null;
}

export function describe(p, fx, r, book) {
  const names = { '1x2': 'Match result', dc: 'Double chance', dnb: 'Draw no bet',
    btts: 'Both teams to score', ou: 'Total goals', ou_team: 'Team goals',
    ou_half: 'Half goals', handicap: 'Handicap', correct_score: 'Correct score',
    clean_sheet: 'Clean sheet', win_to_nil: 'Win to nil' };
  let extra = '';
  if (p.market === 'handicap') {
    const rule = rulesFor(book).handicap;
    extra = ' (' + rule + ' rules' +
            (rule === 'european' && p.line % 1 === 0
              ? ', so ' + p.line + ' settles like ' + (p.line - 0.5) : '') + ')';
  }
  return (names[p.market] || p.market) + ', 90 mins ' + fx.hg + '-' + fx.ag +
         ' → ' + r.replace('_', ' ') + extra;
}

/* =========================================================================
   TENNIS
   =========================================================================
   Its own grader, not a football market list with the words changed. The
   unit of a tennis result is the set, the fixture carries the games in each
   one, and none of the football markets mean anything here.

   What it will grade, and only from what the feed proves:
     match winner        from sets won
     set betting (2-0)   from sets won
     total sets          from sets won
     total games         from every set's games, and only when every set is
                         present, because a missing set makes the total a
                         floor rather than a number
   Everything else, including games handicaps and anything in-play, asks.

   A retirement is always ask. Bookmakers differ irreconcilably: some void
   the match market, some pay the player who advanced, and the totals markets
   are voided by some and settled by others. There is no answer that is right
   for every user, so there is no answer here. */
export const TENNIS_DEAD_VOID = { POSTPONED: 1, CANCELLED: 1, CANCELED: 1 };
export const TENNIS_DEAD_ASK = {
  RETIRED: 1, WALKOVER: 1, WO: 1, ABANDONED: 1, INTERRUPTED: 1, SUSPENDED: 1, AWARDED: 1
};

/** Total games across every set, or null when a set is missing. */
export function totalGames(fx) {
  if (!Array.isArray(fx.sets) || !fx.sets.length) return null;
  let total = 0;
  for (const set of fx.sets) {
    if (typeof set[0] !== 'number' || typeof set[1] !== 'number') return null;
    total += set[0] + set[1];
  }
  /* The sets played must account for the sets won, or the feed has given a
     partial match and the total is a floor rather than a figure. */
  if (typeof fx.hg === 'number' && typeof fx.ag === 'number' &&
      fx.sets.length < fx.hg + fx.ag) return null;
  return total;
}

export function settleTennis(bet, fx) {
  const st = String(fx.status || '').toUpperCase().trim();
  if (TENNIS_DEAD_VOID[st]) {
    return { status: 'settled', result: VOID, outcome: 'void',
             payout: bet.stakePence, profit: 0,
             reason: 'Match ' + st.toLowerCase() + ', stake returned' };
  }
  if (TENNIS_DEAD_ASK[st]) {
    return { status: 'ask',
             reason: 'Match ' + st.toLowerCase() + '. Bookmakers settle these differently, so you decide' };
  }
  if (FINISHED_UNPROVABLE[st]) {
    return { status: 'ask', reason: 'Finished, but the feed did not prove the set score' };
  }
  if (!FINISHED[st]) return { status: 'pending', reason: 'Not finished (' + fx.status + ')' };
  if (typeof fx.hg !== 'number' || typeof fx.ag !== 'number') {
    return { status: 'ask', reason: 'Result came back without a set score' };
  }

  const t = norm(bet.selection);
  const st_ = soft(bet.selection);
  if (!t) return { status: 'ask', reason: 'Could not read this market with confidence' };
  if (NEEDS_MORE.some(re => re.test(st_)) || /\bace|double fault|break of serve|service game/.test(st_)) {
    return { status: 'ask', reason: 'Needs player or in play detail we do not have' };
  }

  const side = sideOf(bet.selection, fx);
  const won = fx.hg > fx.ag ? 'home' : 'away';
  let r = null, market = '';

  /* Set betting, before the plain winner: "Alcaraz 2-0" names a player AND
     a scoreline, and reading only the name would settle a 2-1 as a win. */
  let m = /\b(\d)\s*[- ]\s*(\d)\b/.exec(t);
  if (m && side && Number(m[1]) + Number(m[2]) <= 5) {
    market = 'set betting';
    const forSide = side === 'home' ? [fx.hg, fx.ag] : [fx.ag, fx.hg];
    r = (Number(m[1]) === forSide[0] && Number(m[2]) === forSide[1]) ? WON : LOST;
  } else if (/\bstraight sets?\b/.test(t) && side) {
    market = 'straight sets';
    const dropped = side === 'home' ? fx.ag : fx.hg;
    r = (side === won && dropped === 0) ? WON : LOST;
  } else if (/\bto win a set\b/.test(t) && side) {
    market = 'to win a set';
    r = ((side === 'home' ? fx.hg : fx.ag) >= 1) ? WON : LOST;
  } else if ((m = /\b(over|under)\b.*?(\d+(?:\.\d+)?)\s*(games?|sets?)?/.exec(t))) {
    const line = Number(m[2]);
    const isGames = /games?/.test(t) || line > 6;
    const value = isGames ? totalGames(fx) : fx.hg + fx.ag;
    if (value == null) {
      return { status: 'ask', reason: 'The feed did not give every set, so the games total cannot be proved' };
    }
    market = isGames ? 'total games' : 'total sets';
    /* Whole lines push, exactly as they do in football. */
    r = vsLine(value, line);
    if (m[1] === 'under') r = flip(r);
  } else if ((m = /\b(?:(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)|set (\d))\b/.exec(t)) && side) {
    /* One named set. The feed gives the games in each, so this is provable
       rather than inferred, and it must be handled explicitly: falling
       through to the branch below would have graded "first set winner" as
       the match winner, which is right about half the time. */
    const ordinals = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3,
                       fourth: 4, '4th': 4, fifth: 5, '5th': 5 };
    const n = m[1] ? ordinals[m[1]] : Number(m[2]);
    const set = Array.isArray(fx.sets) ? fx.sets[n - 1] : null;
    if (!set) {
      return { status: 'ask', reason: 'The feed did not give set ' + n + ' on its own' };
    }
    market = 'set ' + n;
    const mine = side === 'home' ? set[0] : set[1];
    const theirs = side === 'home' ? set[1] : set[0];
    r = mine > theirs ? WON : LOST;
  } else if (side && !/\bsets?\b|\bgames?\b/.test(t)) {
    market = 'match winner';
    r = side === won ? WON : LOST;
  }

  if (!r) return { status: 'ask', reason: 'Market understood but the feed lacks the data' };
  if (r === HALF_WON || r === HALF_LOST) {
    return { status: 'ask', reason: 'Quarter lines in tennis are settled differently per bookmaker' };
  }

  const payout = payoutFor(r, bet.stakePence, bet.odds);
  const games = totalGames(fx);
  return { status: 'settled', result: r, market,
           outcome: ledgerOutcome(r), payout,
           profit: payout - bet.stakePence,
           reason: market + ', ' + fx.hg + '-' + fx.ag + ' in sets' +
                   (games != null ? ' (' + games + ' games)' : '') +
                   ' → ' + r.replace('_', ' ') };
}

/**
 * Grade a single bet against a fixture.
 * @param {{selection:string, stakePence:number, odds:number, book?:string, legs?:Array, sport?:string}} bet
 * @param {object|null} fx  fixture result from the feed
 * @returns {{status:'settled'|'ask'|'pending', ...}}
 */
export function settle(bet, fx) {
  if (!fx) return { status: 'pending', reason: 'No result yet' };

  /* A BET BUILDER NEVER GRADES ITSELF.
   *
   * Its legs are correlated selections inside one fixture, priced as a
   * single product, and several of them turn on things no results feed
   * publishes: shots, cards, corners, a named player. The locked rules
   * already say same-game multis always come back to the user, and this is
   * where that is enforced rather than hoped for. Checked before anything
   * is parsed, because the cost of getting this wrong is a wrong grade on
   * somebody's real money.
   *
   * Multiples and systems fall through: an accumulator across separate
   * fixtures is graded leg by leg below, and a system is refused where the
   * legs are read. */
  if (bet.betType === 'bet_builder') {
    return { status: 'ask',
             reason: 'A bet builder is priced as one selection and its legs are ' +
                     'correlated, so it is settled by hand' };
  }
  if (bet.betType === 'system') {
    return { status: 'ask',
             reason: 'A system bet covers several combinations from one stake, ' +
                     'so it is settled by hand' };
  }

  /* Route before parsing. The football market list is greedy enough to find
     something it recognises in a tennis or a racing selection, and grading
     "Over 2.5" on a tennis match against goals is exactly the silent wrong
     answer this engine exists to avoid. */
  const sport = sportOf({ event: fx.event || bet.event, selection: bet.selection,
                          market: bet.market, sport: bet.sport || fx.sport });
  if (sport === 'horses') return { status: 'ask', reason: HORSES_REASON };
  if (sport === 'tennis') return settleTennis(bet, fx);

  const st = String(fx.status || '').toUpperCase().trim();

  if (DEAD_VOID[st]) {
    return { status: 'settled', result: VOID, outcome: 'void',
             payout: bet.stakePence, profit: 0,
             reason: 'Fixture ' + st.toLowerCase() + ', stake returned' };
  }
  if (DEAD_ASK[st]) {
    return { status: 'ask',
             reason: 'Match ' + st.toLowerCase() + '. Bookmakers differ on these, so you decide' };
  }

  let use = fx;
  if (EXTRA[st]) {
    const n = ninetyMinute(fx);
    if (!n) {
      return { status: 'ask',
               reason: 'Went to extra time and the 90 minute score is not in the feed' };
    }
    use = n;
  } else if (FINISHED_UNPROVABLE[st]) {
    /* Over, but not provably at 90 minutes. Ask rather than leave it
       looking like it is still being played. */
    return { status: 'ask',
             reason: 'Finished, but the feed cannot prove the 90 minute score on this one' };
  } else if (!FINISHED[st]) {
    return { status: 'pending', reason: 'Not finished (' + fx.status + ')' };
  }

  if (typeof use.hg !== 'number' || typeof use.ag !== 'number') {
    return { status: 'ask', reason: 'Result came back without a score' };
  }

  if (bet.legs && bet.legs.length) return settleMulti(bet, use);

  const p = parseSelection(bet.selection, use, bet.market);
  if (!p) return { status: 'ask', reason: 'Could not read this market with confidence' };
  if (p.market === 'needs_more') {
    return { status: 'ask', reason: 'Needs player, event or in play detail we do not have' };
  }

  const r = gradeMarket(p, use, bet.book);
  if (!r) return { status: 'ask', reason: 'Market understood but the feed lacks the data' };

  const payout = payoutFor(r, bet.stakePence, bet.odds);
  return { status: 'settled', result: r, market: p.market,
           outcome: ledgerOutcome(r), payout,
           profit: payout - bet.stakePence,
           reason: describe(p, use, r, bet.book) };
}

/* Accumulators. All legs must grade or the whole bet defers. Void legs
   drop out and the odds recalculate on the survivors.

   A quarter-line leg that half wins or half loses splits the stake, which
   has no single agreed treatment inside an acca, bookmakers differ on
   whether the split applies to the leg or the whole slip. Rather than pick
   one and be wrong for half our users, we ask. */
export function settleMulti(bet, fxDefault) {
  let odds = 1, anyLost = false, voided = 0;
  const detail = [];
  for (let i = 0; i < bet.legs.length; i++) {
    const leg = bet.legs[i];
    let fx = leg.fixture || fxDefault;
    if (!fx) return { status: 'pending', reason: 'A leg has no result yet' };
    const st = String(fx.status || '').toUpperCase().trim();
    if (DEAD_VOID[st]) { voided++; detail.push(leg.selection + ': void'); continue; }
    if (DEAD_ASK[st]) return { status: 'ask', reason: 'A leg was ' + st.toLowerCase() };
    if (EXTRA[st]) {
      const n = ninetyMinute(fx);
      if (!n) return { status: 'ask', reason: 'A leg went to extra time' };
      fx = n;
    } else if (!FINISHED[st]) {
      return { status: 'pending', reason: 'A leg is still running' };
    }

    const p = parseSelection(leg.selection, fx, leg.market || bet.market);
    if (!p || p.market === 'needs_more') {
      return { status: 'ask', reason: 'Cannot grade leg: ' + leg.selection };
    }
    const r = gradeMarket(p, fx, bet.book);
    if (!r) return { status: 'ask', reason: 'Cannot grade leg: ' + leg.selection };
    if (r === HALF_WON || r === HALF_LOST) {
      return { status: 'ask',
               reason: 'Leg on a quarter line splits the stake, and bookmakers ' +
                       'differ inside an acca: ' + leg.selection };
    }
    detail.push(leg.selection + ': ' + r);
    if (r === LOST) anyLost = true;
    else if (r === VOID) voided++;
    else odds *= (leg.odds || 1);
  }
  if (anyLost) {
    return { status: 'settled', result: LOST, outcome: 'lost', payout: 0,
             profit: -bet.stakePence, reason: detail.join(' | ') };
  }
  const allVoid = voided === bet.legs.length;
  const eff = allVoid ? 1 : odds;
  const payout = roundPence(bet.stakePence * eff);
  return { status: 'settled', result: allVoid ? VOID : WON,
           outcome: allVoid ? 'void' : 'won',
           payout, profit: payout - bet.stakePence,
           reason: detail.join(' | ') + (voided ? ' (' + voided + ' void leg dropped)' : '') };
}

/* A user cash out. Never inferred from a feed, always an explicit action,
   because no results API can tell you someone took the money early. */
export function settleCashOut(bet, returnedPence) {
  const profit = roundPence(returnedPence) - bet.stakePence;
  return { status: 'settled', result: 'cash', outcome: cashOutcome(profit),
           payout: roundPence(returnedPence), profit,
           reason: 'Cashed out by you' };
}
