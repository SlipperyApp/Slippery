/* DOES THE APP RENDER WHAT THE PROTOTYPE RENDERS?
 *
 * The prototype is the visual and copy specification. Asserting that the port
 * is faithful by reading the diff is not the same as checking, so this loads
 * the prototype itself, drives its harness through all 35 views and every
 * sheet, drives the app through the same, and compares what each one puts on
 * screen.
 *
 * Text is compared exactly after whitespace is collapsed. A single changed
 * word is a failure, because copy is final and "if a string is in the
 * prototype, use it exactly".
 *
 * The differences that are expected are listed in ALLOWED below, each with
 * the rule that overrides the prototype. Anything not on that list fails.
 * Structural differences that are not copy are handled before comparing:
 * the app inserts one visually hidden h1 naming the view, it paints into the
 * page rather than a 390px phone frame, and it has no harness toolbar.
 */

/* WHERE THIS DELIBERATELY DOES NOT MATCH THE PROTOTYPE.
 *
 * "The prototype is the visual and copy specification. This document is the
 * data and behaviour specification. Prototype wins on look, this document
 * wins on rules." Each entry is a place a rule wins, named here so it is a
 * decision on the record rather than a silent divergence. */
const ALLOWED: { view: string; because: string; expect: RegExp }[] = [
  {
    view: 'sheet:card',
    because:
      'The prototype draws a card form: three plain inputs with a test card number ' +
      'typed into them and a Save button that showed "Card updated" and did nothing. ' +
      'Collecting card details on this origin would put the whole deployment inside ' +
      'PCI scope, for a form that was not even wired up. Stripe\'s Billing Portal ' +
      'handles the card, the plan change and the cancellation, with SCA and 3DS ' +
      'behind it. This is the one place a rule beats the prototype on look as well ' +
      'as on behaviour.',
    expect: /held by Stripe, never by Slippery/,
  },
  {
    view: 'landing',
    because:
      'The landing page is the one screen the prototype could not specify, ' +
      'because a single HTML file cannot contain a video. Five storyboards — ' +
      'the settlement carousel, the social deck, the import deck, the Telegram ' +
      'preview and the six-scene autoplay film — are Remotion films now. They ' +
      'were roughly 240 lines of absolutely positioned scenes with five ' +
      'separate timers between them, and most of the page\'s infinite ' +
      'animation. Each film ships in two cuts and the page picks the one that ' +
      'fits the device, so a phone is not handed a letterbox. The hero becomes ' +
      'two columns above 1000px so the product is visible without scrolling, ' +
      'and loses the three-fact list and every standfirst that restated what ' +
      'the section below it then showed. The 01/02/03 numerals are three dots ' +
      'on a connecting line: the numerals said nothing the order of the list ' +
      'did not already say.',
    expect: /Send the screenshot/,
  },
  {
    view: 'reading',
    because:
      'The prototype draws a bet365 slip with four named legs while it pretends ' +
      'to read yours. Rule 6 of this codebase is that there is no demo data in ' +
      'the app, and this is the worst place to break it: four selections somebody ' +
      'never placed, on the screen of a product whose entire claim is an honest ' +
      'record. The plate keeps the scanning animation and names the file instead.',
    expect: /Nothing is saved until you have checked it/,
  },
  {
    view: 'import',
    because:
      'The dropzone navigated to a demo crop screen. It is a real file picker ' +
      'and a real drop target now, posting to the reader. The camera emoji goes ' +
      'with it: rule 8 forbids emoji as interface elements because they ' +
      'rasterise from the system font, cannot take the semantic colours and ' +
      'differ on every platform. It is the sprite icon the tab bar already uses.',
    expect: /Screenshot, PDF or CSV/,
  },
  {
    /* The same screen with the bot already linked: it is built by string
       replacement from V.import, so it inherits the change above. */
    view: 'importlinked',
    because: 'The same screen as `import`, drawn with the bot already linked.',
    expect: /Screenshot, PDF or CSV/,
  },
];

import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { ROUTES } from '../../lib/proto/routes.ts';

const APP = process.env.E2E_BASE || 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 3101;

const problems: string[] = [];
const note = (where: string, what: string) => problems.push(`${where}\n    ${what}`);

/* Where two normalised strings part company, with a window either side.
 *
 * A whole-page diff is unreadable and a bare "these differ" is useless, so
 * this reports the first character that disagrees and forty characters of
 * context from each side. That is almost always enough to name the change:
 * a renamed label, a dropped figure, a reordered row.
 *
 * (Lost along with `main()`'s invocation when the ALLOWED block was pasted
 * over the end of this file, which is why the harness could not run.) */
function firstDifference(want: string, got: string): string {
  const n = Math.min(want.length, got.length);
  let i = 0;
  while (i < n && want[i] === got[i]) i++;
  if (i === n && want.length === got.length) return 'no difference';
  const from = Math.max(0, i - 40);
  const win = (s: string) =>
    (from ? '…' : '') + s.slice(from, i + 40).replace(/\s+/g, ' ') + (i + 40 < s.length ? '…' : '');
  return `at character ${i}\n      prototype: ${win(want)}\n      port:      ${win(got)}`;
}

/* Collapse the things that are not copy: runs of whitespace, and the count-up
   animation's intermediate values, which are a different number every frame. */
const normalise = (s: string) =>
  s.replace(/\s+/g, ' ')
    .replace(/[+−-]?£[\d,]+\.\d{2}/g, '£#')
    .trim();

async function main() {
  const html = readFileSync('tests/fixtures/prototype.html', 'utf8');
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  }).listen(PORT);

  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    await compareViews(browser);
    await compareSheets(browser);
    await compareThemes(browser);
  } finally {
    await browser.close();
    server.close();
  }

  if (problems.length) {
    console.error(`\nDIVERGES FROM THE PROTOTYPE in ${problems.length} places:\n`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log('\nEvery view, every sheet and every theme matches the prototype.');
}

async function open(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage({
    /* Compared at a desktop width. The prototype's harness defaults to its
       desktop layout and only simulates a phone through a class the port
       does not have, so comparing at 390 would put the two sides in
       different layouts and report every view as different. */
    viewport: { width: 1280, height: 900 },
    /* Settled rather than mid-entrance: the prototype staggers its sections
       in, and comparing during the stagger compares two different frames. */
    reducedMotion: 'reduce',
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return page;
}

const readBody = (page: Page) =>
  page.evaluate(() => (document.querySelector('#ph .body') as HTMLElement)?.innerText ?? '');

const readSheet = (page: Page) =>
  page.evaluate(() => (document.querySelector('#ph .sheet') as HTMLElement)?.innerText ?? '');

async function compareViews(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/');

  const views = Object.keys(ROUTES);
  for (const view of views) {
    await spec.evaluate((v) => (0, eval)('go')(v), view);
    await spec.waitForTimeout(420);
    await app.evaluate((v) => (window as any).__slippery.go(v), view);
    await app.waitForTimeout(420);

    const want = normalise(await readBody(spec));
    /* The heading the app inserts is read, not drawn, so it is not part of
       what the prototype puts on screen and is removed before comparing. */
    const got = normalise((await readBody(app)).replace(/^[^\n]*\n/, (m) => (m.trim() ? '' : m)));

    if (want !== got) {
      const allowed = ALLOWED.find((a) => a.view === view);
      if (!allowed) {
        note(`view ${view}`, firstDifference(want, got));
      } else if (!allowed.expect.test(got)) {
        note(`view ${view}`, 'diverges from the prototype AND from what the rule requires.\n      ' +
          allowed.because + '\n      ' + firstDifference(want, got));
      } else {
        console.log(`view ${view}: diverges by design.\n  ${allowed.because}\n`);
      }
    }
  }
  await spec.close();
  await app.close();
}

async function compareSheets(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/app');

  /* `const SH` at the top level of a classic script lives in the global
     lexical environment, so it is in scope here even though it is not a
     property of window. */
  const keys: string[] = await spec.evaluate(() => {
    try { return Object.keys((0, eval)('SH')); } catch { return []; }
  });
  {
    const appKeys: string[] = await app.evaluate(() => (window as any).__slippery.sheetKeys);
    const specKeys = keys.length ? keys : sheetKeysFromSource();
    const missing = specKeys.filter((k) => !appKeys.includes(k));
    /* A sheet the port adds on purpose is declared here rather than in
       ALLOWED, because this check compares the key list rather than the
       rendered text and never looks a key up. Each one still needs its own
       ALLOWED entry for its content. */
    const ADDED_ON_PURPOSE = new Set([
      /* 57 · Deposits and withdrawals. The prototype had no way to record
         money in or out that is not a bet, so a balance was wrong for anyone
         who ever topped up. */
      'adjust',
      /* 11 · Currency. The euro symbol appeared zero times in the product
         while "Irish" appeared nine times on the marketing site. */
      'currency',
      /* 13 · The settlement working. */
      'working',
    ]);
    const extra = appKeys.filter((k) => !specKeys.includes(k) && !ADDED_ON_PURPOSE.has(k));
    if (missing.length) note('sheets', 'the app is missing: ' + missing.join(', '));
    if (extra.length) note('sheets', 'the app has sheets the prototype does not: ' + extra.join(', '));

    for (const key of specKeys) {
      await spec.evaluate((k) => (0, eval)('sheet')(k), key);
      await spec.waitForTimeout(320);
      await app.evaluate((k) => (window as any).__slippery.sheet(k), key);
      await app.waitForTimeout(320);
      const want = normalise(await readSheet(spec));
      const got = normalise(await readSheet(app));
      if (want !== got) {
        const allowed = ALLOWED.find((a) => a.view === 'sheet:' + key);
        if (!allowed) note(`sheet ${key}`, firstDifference(want, got));
        else if (!allowed.expect.test(got)) {
          note(`sheet ${key}`, 'diverges from the prototype AND from what the rule requires.\n      ' +
            allowed.because + '\n      ' + firstDifference(want, got));
        } else {
          console.log(`sheet ${key}: diverges by design.\n  ${allowed.because}\n`);
        }
      }
      await spec.evaluate(() => (0, eval)('closeSheet')());
      await app.evaluate(() => (window as any).__slippery.closeSheet());
      await spec.waitForTimeout(120);
      await app.waitForTimeout(120);
    }
  }
  await spec.close();
  await app.close();
}

/* THE EIGHT THEMES, TOKEN BY TOKEN.
   Every colour in the product comes from these blocks, so if one token differs
   the whole theme is a near miss that nobody can point at. */
async function compareThemes(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/app');

  const TOKENS = ['--pos', '--neg', '--a', '--bg', '--p', '--s', '--card', '--line',
    '--t1', '--t2', '--t3', '--t4', '--elev', '--lg1', '--lg2'];
  /* The eight the redesign ships, darkest to lightest. Tide, Light and Linen
   are gone; Carbon, Cinnabar and Liquid replace them, and Carbon is the
   default. */
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid'];

  for (const theme of THEMES) {
    const read = (page: Page, apply: string) =>
      page.evaluate(([t, tokens, how]) => {
        const el = document.getElementById('ph')!;
        if (how === 'app') (window as any).__slippery.setTheme(t);
        else { el.dataset.t = t; document.body.dataset.t = t; }
        const cs = getComputedStyle(el);
        return Object.fromEntries((tokens as string[]).map((k) => [k, cs.getPropertyValue(k).trim()]));
      }, [theme, TOKENS, apply] as [string, string[], string]);

    const want = await read(spec, 'spec');
    const got = await read(app, 'app');
    for (const token of TOKENS) {
      if (want[token] !== got[token]) {
        note(`theme ${theme}`, `${token} is "${got[token]}", the prototype says "${want[token]}"`);
      }
    }
  }
  await spec.close();
  await app.close();
}

function sheetKeysFromSource(): string[] {
  const src = readFileSync('tests/fixtures/prototype.html', 'utf8');
  const start = src.indexOf('Object.assign(SH,{');
  const end = src.indexOf('\n});', start);
  const block = src.slice(start, end);
  const keys = new Set<string>();
  /* A sheet is a property at the top level of the Object.assign block, which
     is the only place in the file indented by exactly one space. */
  for (const m of block.matchAll(/^ ([a-zA-Z][a-zA-Z0-9_]*)\s*[:(]/gm)) keys.add(m[1]);
  return [...keys];
}

/* The remaining declared divergences. These were appended in a later pass and
   landed inside `sheetKeysFromSource` above, which left the file unparseable
   and the harness unrunnable — it is only split from the ALLOWED literal by
   where it was written, so it is pushed onto the same list. */
ALLOWED.push(
  {
    view: 'demo',
    because:
      'The demo is the dashboard, so it carries the reworked staking chart below.',
    expect: /on plan/,
  },
  {
    view: 'overview',
    because:
      'STAKING DISCIPLINE was six vertical bars of absolute stake with a dashed ' +
      'line across them at one unit, which asks the reader to read each bar, ' +
      'find the line and judge the gap, six times. The question is not what did ' +
      'I stake, it is did I stake to plan. Every week now shares a baseline at ' +
      'one unit: on plan is a dot on the line, over plan is a bar as long as ' +
      'the overshoot. Discipline becomes a shape rather than an arithmetic ' +
      'exercise. The breakdown cards also gain a sparkline each, because a ' +
      'total says where you are and nothing about which way you are going, and ' +
      'the two lead to opposite decisions.',
    expect: /on plan/,
  },
  {
    view: 'su1',
    because:
      'ONE DOOR. Sign in and sign up were two screens with a link between them, ' +
      'asking somebody to declare something the server already knows. One ' +
      'screen now, no toggle, with the branch decided server side and only on ' +
      'a correct password, so it is not an account-enumeration oracle. Social ' +
      'above the divider, email below, one primary action and everything else ' +
      'at outline weight. Terms and Privacy are real buttons rather than a ' +
      '"by continuing you agree" line, which asks somebody to accept a ' +
      'document they have not been shown.',
    expect: /Sign in or create an account/,
  },
  {
    view: 'login',
    because: 'The same screen as `su1`. There is only one door now.',
    expect: /Sign in or create an account/,
  },
  {
    view: 'review',
    because:
      'Three invented bets were hard coded into the review list. It renders ' +
      'what the reader returned, and says so plainly when nothing has been ' +
      'read: the one screen where you confirm what will enter your ledger ' +
      'cannot be showing somebody else\'s bets. Two sentences saying the same ' +
      'thing became one.',
    expect: /No slip has been read yet|bets? found/,
  },
  {
    view: 'referrals',
    because:
      'The note repeated the line directly above it — that the person you refer ' +
      'gets the longer trial — and only its second half was new.',
    expect: /No reward on your side/,
  },
  {
    view: 'sheet:legalDoc',
    because:
      'The acknowledgement is disabled until the document has been scrolled to ' +
      'the end, so the copy says scroll rather than read: it now describes a ' +
      'condition the button actually enforces instead of asking politely.',
    expect: /Scroll to the end/,
  },
  {
    view: 'sheet:terms',
    because: 'The same document sheet as `legalDoc`.',
    expect: /Scroll to the end/,
  },
  {
    view: 'sheet:privacypol',
    because: 'The same document sheet as `legalDoc`.',
    expect: /Scroll to the end/,
  },
  {
    view: 'su4',
    because:
      'The worked example the prototype showed is kept, on the owner\'s ' +
      'instruction, and the live preview of a sample month at the chosen unit ' +
      'is added beside it rather than in place of it. Two ways of answering ' +
      '"what is a unit" for the price of one screen.',
    expect: /SAMPLE MONTH/,
  },
  {
    view: 'ledger',
    because:
      'The exposure chip is labelled. A pound figure beside a percentage with ' +
      'no label read as a balance to more than one person who saw it.',
    expect: /OPEN EXPOSURE/,
  },
  {
    view: 'history',
    because: 'The same labelled exposure chip as `ledger`.',
    expect: /OPEN EXPOSURE/,
  },
  {
    view: 'offline',
    because: 'The same labelled exposure chip as `ledger`.',
    expect: /OPEN EXPOSURE/,
  },
  {
    view: 'social',
    because:
      'A group row carries a stack of member avatars, so the row says who is ' +
      'in the group and not only how many. Above 1000px the page is also a ' +
      'list beside the group it selects: two rows and two buttons left 57% of ' +
      'a desktop window empty, because the page was drawn as a phone list and ' +
      'then handed a 1154px column.',
    expect: /Sunday League/,
  },
  {
    view: 'imphist',
    because:
      'Importing history is source-first now. The prototype opened with a ' +
      'paragraph about who needs this; the port opens with the five steps and ' +
      'the six sources, because somebody on this screen has already decided ' +
      'they need it and wants to know whether their bookmaker is listed.',
    expect: /1 · Source/,
  },
  {
    view: 'fresh',
    because:
      'An empty dashboard said "No bets yet" in an empty box, which shows what ' +
      'is missing and not what it is for. It now ghosts the real module at .52 ' +
      'opacity behind a radial fade, so the shape of the answer is visible ' +
      'before there is any data to put in it.',
    expect: /This fills in as you go/,
  },
  {
    view: 'freshledger',
    because: 'The same ghosted empty state as `fresh`.',
    expect: /./,
  },
  {
    view: 'freshsocial',
    because: 'The same ghosted empty state as `fresh`.',
    expect: /./,
  },
  {
    view: 'sheet:editov',
    because:
      'The bulk control reads "Turn all off" when everything is already on, ' +
      'which is what the button will do. The prototype always said "Turn all ' +
      'on", including when there was nothing left to turn on.',
    expect: /Turn all o(n|ff)/,
  },
  {
    view: 'settings',
    because:
      '57 · The row said "Bankroll · Starting balance, so growth shows as a ' +
      'percentage" while the sidebar said "Bankroll £4,171" — one word for two ' +
      'numbers four times apart. Settings now says Starting bankroll and the ' +
      'sidebar says Balance, because one is set and the other is derived.',
    expect: /Starting bankroll/,
  },
  {
    view: 'sheet:bankroll',
    because:
      '57 · The sheet sets one figure and explains the other, and gained a ' +
      'deposits and withdrawals ledger. Without one, anyone who tops up has a ' +
      'balance that is permanently wrong and "% of bankroll" is measured ' +
      'against a number that stopped being true the day they added to it.',
    expect: /Deposits and withdrawals/,
  },
  {
    view: 'sheet:adjust',
    because:
      '57 · New. Recording money in or out that is not a bet. It moves the ' +
      'balance and never the net, because it is not a result.',
    expect: /Money in or out/,
  },
  {
    view: 'su3',
    because:
      '02 · The display-name field had no label at all, so a screen reader '
      + 'announced an unlabelled text box on the one screen where you name '
      + 'yourself. Labelled, with autocomplete="nickname"; the promo field '
      + 'beside it got the same treatment.',
    expect: /Display name/i,
  },
  {
    view: 'person',
    because:
      '07 · The "Following" button only ever raised a toast. Removed rather '
      + 'than faked: following means nothing until there is a feed to follow '
      + 'into, and a dead control reads as a broken app. It returns with the '
      + 'feed.',
    expect: /Units/,
  },
  {
    view: 'bs_failed',
    because:
      '07 · A failed payment is the most valuable moment you get with a '
      + 'paying customer, and this was a narrow column with a dead "Try again '
      + 'now" in it. It now names the card, the amount, the reason and the '
      + 'deadline, says what read-only actually means — you keep reading and '
      + 'exporting, nothing is deleted for non-payment — and retries through '
      + "Stripe's portal, which is where a payment can genuinely be "
      + 're-attempted.',
    expect: /Card on file/,
  },
  {
    view: 'sheet:privacy',
    because:
      '06 · Other Slippery users are Slippers throughout the product. '
      + '"Members" is kept for people inside a specific group, because that '
      + 'is a role rather than an identity.',
    expect: /Slippers you follow back/,
  },
  {
    view: 'groupdetail',
    because:
      '16 · The group page was 42% empty with a member list on it. The '
      + 'monthly league is what a group is for, so the table leads and the '
      + 'members follow: points from the head to head, units as goal '
      + 'difference, and the three rules that stop it being gamed — a ±3u cap '
      + 'shown rather than applied quietly, resting that protects rather than '
      + 'relegates, and slip-backed only in global divisions.',
    expect: /League One/,
  },
  {
    view: 'sheet:betdetail',
    because:
      '13 · A settled bet shows its working. Rule 4, dead heats, place terms '
      + 'and commission are unglamorous and are exactly why people abandon '
      + 'trackers — and one that shows how it reached a number is trusted on '
      + 'every other number it prints.',
    expect: /How this settled/,
  },
  {
    view: 'sheet:working',
    because:
      '13 · New. The arithmetic, step by step, built from the same fields the '
      + 'grader used so it cannot describe a calculation that did not happen.',
    expect: /How this settled/,
  },
  {
    view: 'sheet:day',
    because:
      '11 · Money is always two decimals, totals included. The prototype '
      + 'showed "Staked £90" beside "+£112.00", which is the ragged column '
      + 'tabular figures exist to prevent.',
    expect: /Staked/,
  },
  {
    view: 'sheet:currency',
    because:
      '11 · New. One currency per account, set at onboarding from the '
      + 'country. Figures are never summed across two, so there is no "both" '
      + 'and no conversion — a Net that adds pounds and euros together is not '
      + 'a number of anything.',
    expect: /Pounds sterling/,
  },
);

/* The call that runs all of the above. It was lost along with the closing
   brace of `sheetKeysFromSource` when the block above was pasted in, which
   made the harness exit 0 having compared nothing — a green result that
   meant only that the file had loaded. */
/* Runs everything above. Kept as the last statement in the file and marked,
   because an ALLOWED block has now twice been appended onto this call's
   argument list instead of onto the push above it — the file used to end in
   `);` either way, so a search for the last one found the wrong paren.
   ── NOTHING GOES BELOW THIS LINE. New entries go in ALLOWED.push(...). ── */
await main();

