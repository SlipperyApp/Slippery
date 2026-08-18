/* A fake backend for the audit.
 *
 * The app now refuses to render a dashboard without a session, which is
 * correct, but it means the audit can no longer reach any of the signed-in
 * UI, and that is most of the surface worth auditing.
 *
 * The wrong fix would be a demo mode compiled into the product. The right
 * one is to stub the network: Playwright intercepts the same fetches the
 * real app makes and answers with fixture JSON, so every line of client code
 *, session check, hydrate, render, settle, runs exactly as it does in
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
  /* free, to match the trial the bets stub reports. A paid plan here and a
     trial there would render a counter for an account that cannot have
     one. */
  plan: 'free',
  planUntil: null,
  /* The tick is off, which is the default and the state worth auditing:
     the bug being guarded against is showing it to somebody who has not
     been granted it. */
  verified: false,
  trialEndsAt: null,
  telegramLinked: true,
  telegramUsername: 'dariusodds',
  telegramLinkedAt: '2026-02-14T10:00:00Z',
  /* No code while linked. The two halves of the card are mutually
     exclusive, and a stub that hands back both cannot catch a page that
     shows both. */
  linkCode: null,
  linkCodeExpiresAt: null,
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
  /* Mutable, because signing in is a state change the client has to notice.
     The login bug was exactly this: the browser held the signed-out session
     it read at boot and never asked again, so a correct password bounced
     back to the signup screen. A stub with a frozen flag could not have
     caught it. */
  let signedIn = opts.signedIn !== false;

  /* Mutable, so Unlink can be tested for what it actually does rather
     than for what it says. A frozen user object would let a button that
     lies pass. */
  let user = { ...USER };

  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ configured: true, user: signedIn ? user : null })
  }));

  await page.route('**/api/auth/link', route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    if (sent.action === 'unlink') {
      const was = user.telegramLinked;
      user = { ...user, telegramLinked: false, telegramUsername: null, telegramLinkedAt: null };
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ unlinked: was, telegramLinked: false }) });
    }
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    user = { ...user, linkCode: 'K7M2QP', linkCodeExpiresAt: expires };
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ linkCode: 'K7M2QP', linkCodeExpiresAt: expires, ttlMs: 600000 }) });
  });

  await page.route('**/api/bets', route => {
    const method = route.request().method();
    if (!signedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ error: 'Log in to see your bets.' }) });
    }
    if (method === 'GET') {
      /* A free account partway through its trial, so the audit actually
         renders the trial counter rather than the paid state where it is
         hidden. Nine slips in with four days left puts the bar in its
         ordinary state, not the warning one. */
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ bets: BETS, total: BETS.length, freeSlips: 35,
          plan: 'free', planUntil: null, unlimited: false,
          trial: {
            endsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
            daysLeft: 4, slipsLeft: 26, slipsUsed: 9, over: null, active: true
          } }) });
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
    body: JSON.stringify({ ok: true, name: 'DariusOdds', emailSent: true, plan: 'free' })
  }));
  await page.route('**/api/auth/verify', route => {
    signedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, name: USER.name }) });
  });
  await page.route('**/api/auth/resend', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true })
  }));

  /* Logging in sets the session, exactly as the real cookie would. */
  await page.route('**/api/auth/login', route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    if (!sent.identifier || !sent.password) {
      return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'That username and password do not match.' }) });
    }
    signedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, name: USER.name }) });
  });
  await page.route('**/api/auth/forgot', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, message: 'If that account exists, a reset code is on its way.' })
  }));
  await page.route('**/api/auth/reset', route => {
    signedIn = true;
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, name: USER.name }) });
  });
  await page.route('**/api/promo', route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    if (sent.code !== 'AK5WRD') {
      return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'That code is not one we recognise.', field: 'code' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, plan: 'lifetime', planUntil: null,
        label: 'Free for life', note: 'Slippery is free on this account, permanently.' }) });
  });

  /* Groups. Two members and a real join code, so the board, the code and
     the visibility tag all render the way they do in production. */
  const GROUPS = [{
    id: 'g1', name: 'Sunday League', visibility: 'private', code: 'K7RM24', owner: true,
    mem: ['You', 'HalfEdge']
  }];
  const PEOPLE = [{
    n: 'HalfEdge', a: 'HA', un: 5000,
    months: [0, 0, 0, 0, 0, 0, 12000, 4400, 9100, 0, 0, 0],
    all: 25500, b: 34, roi: 0.11, v: false, pv: 'public', mu: true, ing: false, er: false, gr: [0]
  }];
  /* Following and followers.
     Three states worth having on screen at once: somebody public whose
     figures show, somebody on 'friends' who follows back so they also
     show, and somebody on 'friends' who does not, whose row exists with no
     figures in it. That last one is the case the "private" wording is for,
     and it is the one a regression would quietly turn into zeros. */
  const FOLLOWING = [
    { n: 'ColdLine', a: 'CO', un: 2500,
      months: [0, 0, 0, 0, 0, 3200, 800, 5400, 0, 0, 0, 0],
      all: 9400, b: 21, roi: 0.07, v: true, pv: 'public', mu: true, ing: true, er: false, gr: [] },
    { n: 'QuietStake', a: 'QU', un: 10000,
      months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      all: 0, b: 0, roi: 0, v: false, pv: 'friends', mu: false, ing: true, er: false, gr: [] }
  ];
  const FOLLOWERS = [
    { n: 'NorthEdge', a: 'NO', un: 5000,
      months: [0, 0, 0, 0, 0, 0, -4100, 2600, 0, 0, 0, 0],
      all: -1500, b: 17, roi: -0.02, v: false, pv: 'friends', mu: false, ing: false, er: true, gr: [] }
  ];
  await page.route('**/api/people*', route => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (method === 'GET' && url.searchParams.get('q')) {
      const q = url.searchParams.get('q').toLowerCase();
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ people: FOLLOWING.concat(FOLLOWERS)
          .filter(p => p.n.toLowerCase().includes(q))
          .map(p => ({ n: p.n, a: p.a, pv: p.pv, v: p.v, ing: p.ing })) }) });
    }
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ following: FOLLOWING, followers: FOLLOWERS }) });
    }
    const sent = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ status: method === 'DELETE' ? 200 : 201, contentType: 'application/json',
      body: JSON.stringify({ following: method !== 'DELETE', name: sent.follow }) });
  });

  await page.route('**/api/auth/profile', route => {
    const sent = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, unitPence: sent.unitPence || 10000,
        privacy: sent.privacy || 'friends' }) });
  });

  /* The trailing * matters: the directory is GET /api/groups?browse=1, and
     a pattern without it does not match a URL with a query string, so the
     request would fall through to the dev server and 404. */
  const DIRECTORY = [
    { id: 'p1', name: 'Acca Merchants', members: 34, joined: false, full: false },
    { id: 'p2', name: 'Bankroll Club', members: 12, joined: true, full: false },
    { id: 'p3', name: 'Closed Shop', members: 200, joined: false, full: true },
    { id: 'p4', name: 'Sunday League Syndicate', members: 7, joined: false, full: false,
      visibility: 'private' },
    /* Somebody who has already asked. The row must say Asked rather than
       offering the button again. */
    { id: 'p5', name: 'Quiet Stakes', members: 4, joined: false, full: false,
      visibility: 'private', asked: true }
  ];
  const REQUESTS = [
    { groupId: 'g1', groupName: 'Sunday League', userId: 'u9', person: 'DariusOdds',
      at: '2026-08-12T10:00:00Z' }
  ];
  await page.route('**/api/groups*', route => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    if (method === 'GET' && url.searchParams.has('browse')) {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const sort = url.searchParams.get('sort') || 'popular';
      let rows = q ? DIRECTORY.filter(g => g.name.toLowerCase().includes(q)) : DIRECTORY.slice();
      if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
      else if (sort === 'popular') rows.sort((a, b) => b.members - a.members);
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ groups: rows, sort, limit: 100 }) });
    }
    if (method === 'GET' && url.searchParams.has('requests')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ requests: REQUESTS }) });
    }
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ groups: GROUPS, people: PEOPLE }) });
    }
    const sent = JSON.parse(route.request().postData() || '{}');
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ left: sent.id, dissolved: false }) });
    }
    if (sent.code) {
      return route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({ joined: true, group: { id: 'g2', name: 'Joined Group' } }) });
    }
    if (sent.decide) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(sent.accept ? { accepted: true } : { declined: true }) });
    }
    /* 202 and `asked`, not 201 and `joined`. Every way into a group goes
       through the owner now. */
    if (sent.join) {
      return route.fulfill({ status: 202, contentType: 'application/json',
        body: JSON.stringify({ asked: true, group: { id: sent.join, name: 'Acca Merchants' } }) });
    }
    /* A taken name is the interesting create response, since the whole
       point of platform-wide uniqueness is that this path is reachable. */
    if (String(sent.name || '').toLowerCase() === 'acca merchants') {
      return route.fulfill({ status: 409, contentType: 'application/json',
        body: JSON.stringify({ error: 'The name ' + sent.name + ' is taken. Group names are one per platform.',
          field: 'name', taken: true }) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json',
      body: JSON.stringify({ group: { id: 'g2', name: sent.name, visibility: sent.visibility,
        code: 'QT9WFB', owner: true, mem: ['You'] } }) });
  });

  /* The slip reader. Returns one legible slip and one the reader could only
     partly make out, which is the case the editable fields exist for. */
  let extractCall = 0;
  /* The audit needs a specific fixture at a specific moment (the multi-bet
     page), and counting how many calls earlier checks happened to make is
     how that assertion rots. installStub returns a controller instead. */
  let forced = null;
  await page.route('**/api/extract', route => {
    /* Read the counter once. `extractCall++ % 3` in the first branch and
       `extractCall % 3` in the second read different values, which silently
       skipped a case. */
    if (forced) {
      const fields = forced; forced = null;
      return route.fulfill({ status: 200, contentType: 'application/json',
                             body: JSON.stringify({ fields }) });
    }
    const n = extractCall++ % 4;
    const body = (n === 0)
      /* Unsettled and fully legible: the common case. */
      ? { readable: true, doc_type: 'bet_slip', platform: 'bet365', bet_type: 'single',
          bet_count: 1, selection: 'Over 2.5 Goals', event: 'Arsenal v Chelsea',
          market: 'Over/Under', bookmaker: 'bet365', stake: 25.00, odds: 1.85,
          returns: null, result: 'open', stage: 'prematch', kickoff: null, legs: 1,
          selections: [{ selection: 'Over 2.5 Goals', event: 'Arsenal v Chelsea',
                         market: 'Over/Under', odds: 1.85, result: 'open' }],
          totals: null, placed_at: null, unreadable_fields: [], notes: null }
      : (n === 1)
      /* Legible but missing the stake: the case the editable fields exist for. */
      ? { readable: true, doc_type: 'bet_slip', platform: 'Sky Bet', bet_type: 'single',
          bet_count: 1, selection: 'Under 3.5 Goals', event: null, market: 'Over/Under',
          bookmaker: 'Sky Bet', stake: null, odds: 1.44, returns: null, result: 'open',
          stage: 'inplay', kickoff: null, legs: 1,
          selections: [{ selection: 'Under 3.5 Goals', event: null, market: 'Over/Under',
                         odds: 1.44, result: 'open' }],
          totals: null, placed_at: null, unreadable_fields: ['stake'], notes: null }
      : (n === 2)
      /* Already settled, with the returns printed on it. */
      ? { readable: true, doc_type: 'bet_slip', platform: 'Paddy Power', bet_type: 'single',
          bet_count: 1, selection: 'Under 5.5 Goals',
          event: 'Oskarshamns AIK v IFK Karlshamn', market: 'Over/Under',
          bookmaker: 'Paddy Power', stake: 306.18, odds: 1.25, returns: 382.73,
          result: 'won', stage: 'settled', kickoff: null, legs: 1,
          selections: [{ selection: 'Under 5.5 Goals', event: 'Oskarshamns AIK v IFK Karlshamn',
                         market: 'Over/Under', odds: 1.25, result: 'won' }],
          totals: null, placed_at: null, unreadable_fields: [], notes: null }
      /* A double, with a price on each leg and a combined price. This is the
         shape the slip editor exists for: the legs are editable separately
         and the combined price sits beside them. */
      : { readable: true, doc_type: 'bet_slip', platform: 'Paddy Power', bet_type: 'multiple',
          bet_count: 1, selection: 'Under 5.5 Goals & Under 3.5 Goals',
          event: 'CD Cieza v Valencia-Mestalla & Antequera CF v Granada',
          market: 'Over/Under', bookmaker: 'Paddy Power', stake: 400.00, odds: 1.40,
          returns: null, result: 'open', stage: 'prematch', kickoff: null, legs: 2,
          selections: [
            { selection: 'Under 5.5 Goals', event: 'CD Cieza v Valencia-Mestalla',
              market: 'Over/Under', odds: 1.20, result: 'open' },
            { selection: 'Under 3.5 Goals', event: 'Antequera CF v Granada',
              market: 'Over/Under', odds: 1.17, result: 'open' }
          ],
          totals: null, placed_at: null, unreadable_fields: [], notes: null }
      ;
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ fields: body })
    });
  });

  /* What the caller gets back. Only the audit uses it, and only to pin a
     fixture it needs to assert against. */
  return {
    /* The next /api/extract call answers with exactly this, once. */
    nextExtract(fields) { forced = fields; }
  };
}

/* THREE SEPARATE BETS on one page, each with its own stake, price and
   bookmaker. Exported because it is the case that used to be merged into a
   single bet called "A & B & C" with one arbitrary stake, and the audit
   asserts against it every run. */
export const THREE_BETS = {
  readable: true, doc_type: 'bet_list', platform: 'bet365', bet_type: 'single',
  bet_count: 3, selection: 'Arsenal to win', event: 'Arsenal v Spurs',
  market: 'Match result', bookmaker: 'bet365', stake: 10, odds: 1.90,
  returns: null, result: 'open', stage: 'prematch', kickoff: null, legs: 1,
  selections: [], totals: null, pl_rows: [], placed_at: null,
  unreadable_fields: [], notes: null,
  bets: [
    { selection: 'Arsenal to win', event: 'Arsenal v Spurs', market: 'Match result',
      bookmaker: 'bet365', odds: 1.90, stake: 10, returns: null, result: 'open',
      stage: 'prematch', placed_at: null, selections: [], legs: 1 },
    { selection: 'Spurs to win', event: 'Spurs v Chelsea', market: 'Match result',
      bookmaker: 'Sky Bet', odds: 2.40, stake: 25, returns: null, result: 'open',
      stage: 'prematch', placed_at: null, selections: [], legs: 1 },
    { selection: 'Chelsea to win', event: 'Chelsea v Arsenal', market: 'Match result',
      bookmaker: 'Betfair', odds: 3.10, stake: 5, returns: null, result: 'open',
      stage: 'prematch', placed_at: null, selections: [], legs: 1 }
  ]
};
