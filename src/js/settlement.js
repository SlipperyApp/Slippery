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

/* ---- how each bookmaker settles.
   Asian: a whole-number handicap can push and the stake comes back.
   European (3 way): the same scoreline is a loss, because the handicap
   draw is a separate outcome. So -1 behaves like -1.5 for the backer.

   Lookup table, never hardcoded at the call site, so adding a bookmaker
   is a data change. Keys are compared case-insensitively and with
   punctuation stripped, because slips spell them inconsistently
   ("bet365", "Bet 365", "BET365"). ---- */
export const BOOK_RULES = {
  'bet365':       { handicap: 'asian' },
  'paddypower':   { handicap: 'european' },
  'betfair':      { handicap: 'european' },
  'skybet':       { handicap: 'european' },
  'williamhill':  { handicap: 'european' },
  'ladbrokes':    { handicap: 'european' },
  'coral':        { handicap: 'european' },
  'betfred':      { handicap: 'european' },
  'unibet':       { handicap: 'european' },
  'leovegas':     { handicap: 'european' },
  '32red':        { handicap: 'european' },
  'smarkets':     { handicap: 'european' }
};
export const DEFAULT_RULES = { handicap: 'european' };

export function bookKey(book) {
  return String(book || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
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

export function parseSelection(raw, fx) {
  const t = norm(raw), st = soft(raw);
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

  m = t.match(/([+-]?\d+(?:\.\d+)?)\s*(?:goal)?\s*(?:handicap|hcp|ah)\b/) ||
      t.match(/\b(?:handicap|hcp|ah)\s*([+-]?\d+(?:\.\d+)?)/) ||
      t.match(/\(([+-]\d+(?:\.\d+)?)\)/);
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

/**
 * Grade a single bet against a fixture.
 * @param {{selection:string, stakePence:number, odds:number, book?:string, legs?:Array}} bet
 * @param {object|null} fx  fixture result from the feed
 * @returns {{status:'settled'|'ask'|'pending', ...}}
 */
export function settle(bet, fx) {
  if (!fx) return { status: 'pending', reason: 'No result yet' };
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
  } else if (!FINISHED[st]) {
    return { status: 'pending', reason: 'Not finished (' + fx.status + ')' };
  }

  if (typeof use.hg !== 'number' || typeof use.ag !== 'number') {
    return { status: 'ask', reason: 'Result came back without a score' };
  }

  if (bet.legs && bet.legs.length) return settleMulti(bet, use);

  const p = parseSelection(bet.selection, use);
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

    const p = parseSelection(leg.selection, fx);
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
