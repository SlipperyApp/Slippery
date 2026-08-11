/* A fake backend for the audit.
 *
 * The app now refuses to render a dashboard without a session, which is
 * correct — but it means the audit can no longer reach any of the signed-in
 * UI, and that is most of the surface worth auditing.
 *
 * The wrong fix would be a demo mode compiled into the product. The right
 * one is to stub the network: Playwright intercepts the same fetches the
 * real app makes and answers with fixture JSON, so every line of client code
 * — session check, hydrate, render, settle — runs exactly as it does in
 * production. Nothing is added to the bundle for testing.
 *
 * The fixtures are deliberately awkward: a cash-out, a void, an unsettled
 * bet, a bet the grader asked about, a Nordic fixture with characters NFD
 * does not decompose, and a long event name that has overflowed a row
 * before.
 */

const day = n => new Date(Date.now() - n * 86400000).toISOString();

export const USER = {
  name: 'DariusOdds',
  email: 'darius@example.com',
  emailVerified: true,
  unitPence: 10000,
  plan: 'year',
  telegramLinked: true,
  linkCode: 'SLIP-7F3A',
  since: '2026-02-14T10:00:00Z'
};

export const BETS = [
  { id: 'b1', event: 'Oskarshamns AIK v IFK Karlshamn', selection: 'Under 5.5 Goals',
    market: 'Over/Under', book: 'Paddy Power', odds: 1.25, stake: 30618,
    profit: 7655, outcome: 'won', status: 'settled', placedAt: day(1), source: 'telegram' },
  { id: 'b2', event: 'SK Brann (W) v PAOK (W)', selection: 'Under 4.5 Goals',
    market: 'Over/Under', book: 'Paddy Power', odds: 1.17, stake: 22500,
    profit: -22500, outcome: 'lost', status: 'settled', placedAt: day(1), source: 'upload' },
  { id: 'b3', event: 'Treble, cashed out', selection: '3 legs', market: 'Multiple',
    book: 'bet365', odds: 4.10, stake: 12000, profit: 4820, outcome: 'cash-profit',
    status: 'settled', placedAt: day(2), source: 'telegram' },
  { id: 'b4', event: 'Molde v Bodø/Glimt', selection: 'Molde -1 handicap', market: 'Handicap',
    book: 'Paddy Power', odds: 2.10, stake: 12000, profit: 0, outcome: 'void',
    status: 'settled', placedAt: day(3), source: 'upload' },
  { id: 'b5', event: 'Sirius v Djurgården', selection: 'Over 2.5 Goals', market: 'Over/Under',
    book: 'bet365', odds: 1.90, stake: 10000, profit: 9000, outcome: 'won',
    status: 'settled', placedAt: day(4), source: 'telegram' },
  { id: 'b6', event: 'Slavia Prague v Sparta Prague', selection: 'Match result',
    market: 'Match result', book: 'Betfair', odds: 1.30, stake: 20000, profit: -20000,
    outcome: 'lost', status: 'settled', placedAt: day(5), source: 'upload' },
  { id: 'b7', event: 'Borussia Mönchengladbach v Eintracht Frankfurt', selection: 'Over 3.5 Goals',
    market: 'Over/Under', book: 'William Hill', odds: 2.45, stake: 8000, profit: 11600,
    outcome: 'won', status: 'settled', placedAt: day(6), source: 'upload' },
  /* still running */
  { id: 'p1', event: 'Arsenal v Chelsea', selection: 'Over 2.5 Goals', market: 'Over/Under',
    book: 'bet365', odds: 1.85, stake: 20000, profit: null, outcome: null,
    status: 'pending', placedAt: day(0), source: 'telegram' },
  { id: 'p2', event: 'Bet builder, 3 legs', selection: 'Saka 1+ shot, over 9.5 corners, Arsenal win',
    market: 'Multiple', book: 'Sky Bet', odds: 4.20, stake: 6000, profit: null, outcome: null,
    status: 'pending', placedAt: day(0), source: 'upload' },
  /* graded as uncertain: the engine asked rather than guessing */
  { id: 'p3', event: 'Vaasa v Honka', selection: 'Over 1.5 Goals', market: 'Over/Under',
    book: 'Betfair', odds: 1.60, stake: 18000, profit: null, outcome: null,
    status: 'ask', reason: 'Abandoned at 2-0. Bookmakers differ on abandoned games.',
    placedAt: day(0), source: 'telegram' }
];

/**
 * Point a Playwright page at the fake backend.
 * @param {import('playwright-core').Page} page
 * @param {{signedIn?: boolean}} [opts]
 */
export async function installStub(page, opts = {}) {
  const signedIn = opts.signedIn !== false;

  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ configured: true, user: signedIn ? USER : null })
  }));

  await page.route('**/api/bets', route => {
    const method = route.request().method();
    if (!signedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ error: 'Log in to see your bets.' }) });
    }
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ bets: BETS, total: BETS.length, freeSlips: 20, plan: 'year' }) });
    }
    if (method === 'POST') {
      const sent = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ bet: Object.assign({
          id: 'new' + Date.now(), profit: null, outcome: null,
          status: 'pending', placedAt: new Date().toISOString(), source: 'upload'
        }, sent, { stake: sent.stakePence }) }) });
    }
    if (method === 'PATCH') {
      const sent = JSON.parse(route.request().postData() || '{}');
      const bet = BETS.find(b => b.id === sent.id) || BETS[0];
      /* Mirror what the server would compute, so the client's optimistic
         render is checked against a real answer rather than its own guess. */
      const profit = sent.kind === 'won' ? Math.round(bet.stake * (bet.odds - 1))
        : sent.kind === 'lost' ? -bet.stake
        : sent.kind === 'void' ? 0
        : (sent.returnedPence || 0) - bet.stake;
      const outcome = sent.kind === 'cash'
        ? (profit > 0 ? 'cash-profit' : profit < 0 ? 'cash-loss' : 'cash-flat')
        : sent.kind;
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ bet: Object.assign({}, bet, { profit, outcome, status: 'settled' }) }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  /* The results check. Settles the two plain pending bets and leaves the
     one the grader asked about, which is the realistic shape of an answer. */
  await page.route('**/api/settle', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ provider: 'sofascore', checked: 3, fixtures: 412,
      settled: 1, asked: 1, stillRunning: 1, bets: [] })
  }));

  /* Signup and verification, so the wizard can be driven end to end. */
  await page.route('**/api/auth/signup', route => route.fulfill({
    status: 201, contentType: 'application/json',
    body: JSON.stringify({ ok: true, name: 'DariusOdds', emailVerified: false })
  }));
  await page.route('**/api/auth/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, user: USER })
  }));
  await page.route('**/api/auth/resend', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true })
  }));

  /* The slip reader. Returns one legible slip and one the reader could only
     partly make out, which is the case the editable fields exist for. */
  let extractCall = 0;
  await page.route('**/api/extract', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ fields: (extractCall++ % 2 === 0)
      ? { selection: 'Over 2.5 Goals', event: 'Arsenal v Chelsea', stake: 25.00,
          odds: 1.85, bookmaker: 'bet365', market: 'Over/Under' }
      : { selection: 'Under 3.5 Goals', event: null, stake: null, odds: 1.44,
          bookmaker: 'Sky Bet', market: 'Over/Under' } })
  }));
}
