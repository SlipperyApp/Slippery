/* THE TUTORIAL WALKS THE PRODUCT.
 *
 * It was six paragraphs in a centred modal. Every word of it was true and
 * none of it was attached to anything: "the big number is your profit for
 * the period you pick" sat in a box over a dimmed screen, and the reader
 * had to hold the sentence in their head until they found the thing it
 * described. A tour that describes an interface from on top of it is a
 * help page with a progress bar.
 *
 * Each step now goes to the page, opens whatever has to be open, scrolls
 * the thing into view, and cuts a hole in the scrim around it. The card
 * sits on the opposite side of the target from wherever the target is, so
 * it never covers the thing it is pointing at.
 *
 * HOW THE HOLE IS MADE. One absolutely positioned div with
 * `box-shadow: 0 0 0 9999px` in the scrim colour. Everything outside it is
 * dimmed by that one shadow, so there is one element to move rather than
 * four panels to keep in sync, no seams at the corners, and no
 * backdrop-filter spent — the budget is about three on this product and
 * they are already spoken for. Between steps the hole travels rather than
 * disappearing and reappearing: it is one object, and moving it is what
 * makes the six steps feel like a route rather than six modals.
 *
 * WHAT IT DOES NOT DO. It does not block the target. A tutorial that says
 * "tap Show more" and then eats the tap teaches nothing, so the hole has
 * pointer-events:none and the control underneath stays live.
 *
 * MEASURING. getBoundingClientRect once per step, again on resize and on
 * visualViewport resize, which is the iOS keyboard. Never inside a scroll
 * handler: motion.js already owns the one scroll listener on this page and
 * reading layout inside it is how a compositor animation ends up back on
 * the main thread.
 */
import { $, $$, esc, setText, trapFocus, RM } from './dom.js';
import { S } from './state.js';

/* Filled by main.js, which owns navigation and the panes. Passing them in
   rather than importing keeps this module free of the whole app. */
let go = () => {};
let showPane = () => {};
let onFinish = () => {};

export function wireTour(deps) {
  go = deps.go;
  showPane = deps.showPane;
  onFinish = deps.onFinish || (() => {});
}

/* ---------------- the route ----------------
 *
 * Six stops, in the order somebody meets them. Each one names a real
 * selector: a step pointing at nothing is a step that silently becomes a
 * modal again, so the test reads these and checks they exist.
 *
 *   view    where it lives
 *   pane    which dashboard pane, if any
 *   target  what to put the hole around
 *   before  whatever has to be open first
 *   place   which side of the target the card sits on
 */
export const TOUR = [
  {
    id: 'dash',
    view: 'dash', pane: 'overview',
    target: '.slipcard-hero',
    place: 'below',
    title: 'This is the number',
    body: 'Your real profit or loss for the period you pick, from the bets you have logged. ' +
          'W, M, Y and All change what is counted, not just the label. Under it, the calendar ' +
          'colours every day you have a record for.'
  },
  {
    id: 'more',
    view: 'dash', pane: 'overview',
    target: '#moreToggle',
    place: 'above',
    title: 'Everything else is behind here',
    body: 'Win rate, best run, what each bookmaker actually paid, and your lifetime figures. ' +
          'Kept out of the way on purpose: they are worth reading occasionally and they are ' +
          'not what you open the app for.',
    before: () => { const b = $('moreToggle'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }
  },
  {
    id: 'settings',
    view: 'settings',
    /* Not the first card: that is the theme picker, which is 792px tall,
       and a hole around it is a hole around the screen. The unit is the
       setting that changes what every other figure means. */
    target: '#setUnits',
    place: 'above',
    title: 'Set your unit first',
    body: 'A unit is your standard stake, and it is how groups and following compare people ' +
          'without anybody seeing stake sizes. The rest of Settings is here too: your theme, ' +
          'who can see your figures, and Take a break, which switches logging off for as long ' +
          'as you choose.'
  },
  {
    id: 'history',
    view: 'imp',
    target: '[data-importjob="importHistory"]',
    place: 'below',
    title: 'Bring your history across',
    body: 'A spreadsheet, a statement, or a screenshot of another tracker. Every row is shown ' +
          'to you with its date and amount, and you choose which of them come across before ' +
          'anything is saved.',
    before: () => { const b = $('importBack'); if (b && !b.hidden) b.click(); }
  },
  {
    id: 'addbet',
    view: 'imp',
    target: '[data-importjob="importUpload"]',
    place: 'below',
    title: 'Add a bet you just placed',
    body: 'Photograph the slip or paste it in. Slippery reads the stake, the price and every ' +
          'leg, you check it, and it is tracked from then on. Before kick off, in play or ' +
          'after the result: all three are logged the same way.'
  },
  {
    id: 'bot',
    view: 'settings',
    target: '#tgUnlinked, #tgLinked',
    place: 'above',
    title: 'The fastest way of all',
    body: 'Forward a slip to the bot the moment you place it and it lands here on its own. ' +
          'That is the whole point of Slippery: a record captured before you know how it went ' +
          'cannot quietly become only the bets you wanted to remember.'
  }
];

/* How much vertical space the card needs. Measured rather than guessed
   would be better, but the card's height depends on its own text and
   asking for it before it is painted returns the previous step's. This is
   the tallest the card gets at 390px with the longest body in the set,
   plus its inset from the edge and a gap so the two are not touching. */
const CARD_ROOM = 344;

let at = 0;
let release = null;
let target = null;
let raf = 0;

/* ---------------- opening and closing ---------------- */

export function startTour(from) {
  const el = $('tour');
  if (!el) return;
  at = Math.max(0, Math.min(TOUR.length - 1, from || 0));
  el.hidden = false;
  document.body.classList.add('touring');
  release = trapFocus(el);
  addEventListener('resize', reposition, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', reposition);
  goToStep(at);
}

export function endTour(finished) {
  const el = $('tour');
  if (el) el.hidden = true;
  document.body.classList.remove('touring');
  if (release) { release(); release = null; }
  removeEventListener('resize', reposition);
  if (window.visualViewport) visualViewport.removeEventListener('resize', reposition);
  target = null;
  onFinish(finished);
}

export const tourActive = () => {
  const el = $('tour');
  return Boolean(el && !el.hidden);
};

/* ---------------- moving ---------------- */

export function nextStep() {
  if (at >= TOUR.length - 1) { endTour(true); return; }
  goToStep(at + 1);
}
export function prevStep() {
  if (at <= 0) return;
  goToStep(at - 1);
}

async function goToStep(i) {
  at = i;
  const step = TOUR[i];

  /* Get to the page first, then open whatever has to be open, then find
     the thing. Doing it in any other order measures a target that is
     hidden, and a hidden target measures as zero. */
  if (step.view && S.view !== step.view) go(step.view);
  if (step.pane && S.pane !== step.pane) showPane(step.pane);
  if (step.before) { try { step.before(); } catch { /* a step must not be able to break the tour */ } }

  paintCard(step, i);

  /* One frame for the view switch to paint, then scroll, then measure
     after the scroll has settled. */
  await frame();
  target = document.querySelector(step.target);
  if (target) {
    /* Centring a card taller than the viewport hides its heading, which is
       the part the step is about. */
    const tall = target.getBoundingClientRect().height > window.innerHeight - CARD_ROOM;
    target.scrollIntoView({ block: tall ? 'start' : 'center', behavior: RM ? 'auto' : 'smooth' });
    await settle();
  }
  reposition();
}

function paintCard(step, i) {
  setText('tourStep', 'Step ' + (i + 1) + ' of ' + TOUR.length);
  setText('tourTitle', step.title);
  setText('tourBody', step.body);
  const dots = $('tourDots');
  if (dots) {
    dots.innerHTML = TOUR.map((_, n) =>
      '<i class="' + (n <= i ? 'on' : '') + '"></i>').join('');
  }
  const back = $('tourBack');
  if (back) back.disabled = i === 0;
  const next = $('tourNext');
  if (next) next.textContent = i === TOUR.length - 1 ? 'Finish' : 'Next';
}

/* Put the hole on the target and the card where the target is not.
   Called on move, on resize, and when the iOS keyboard changes the
   viewport. Reads layout exactly once per call. */
function reposition() {
  const hole = $('tourHole');
  const card = $('tourCard');
  const el = $('tour');
  if (!hole || !card || !el || el.hidden) return;

  if (!target || !target.isConnected) {
    /* No target is a legitimate state, not a bug: a step can point at
       something an empty account does not have yet. The scrim stays, the
       hole closes, and the card centres. */
    hole.style.opacity = '0';
    el.dataset.place = 'center';
    return;
  }

  const r = target.getBoundingClientRect();
  if (!r.width || !r.height) { hole.style.opacity = '0'; return; }

  const pad = 6;
  const step = TOUR[at];
  const vh = window.innerHeight;
  const top = Math.max(0, r.top - pad);
  const natural = r.height + pad * 2;

  /* A TARGET TALLER THAN THE ROOM AVAILABLE IS FRAMED FROM ITS TOP.
     Settings' cards run past five hundred pixels. Circling the whole of
     one leaves nowhere for the tutorial card to stand that is not on top
     of it, and a card covering the thing it describes is the failure this
     rewrite was about. So the highlight is clamped to leave the card its
     room, framing the top of a long target, which is where its heading
     is. */
  const roomBelow = vh - top - CARD_ROOM;
  const roomAbove = top - CARD_ROOM;
  const want = step.place === 'above' ? 'above' : 'below';
  /* Below is the fallback whichever way round, because clamping the
     bottom of a target is possible and clamping its top is not: the top
     is where the heading is. */
  const place = want === 'above' && roomAbove > 160 && natural <= vh - top ? 'above' : 'below';
  const height = place === 'below'
    ? Math.max(48, Math.min(natural, roomBelow))
    : Math.min(natural, vh - top);

  hole.style.opacity = '1';
  hole.style.transform = 'translate3d(' + Math.round(r.left - pad) + 'px,' +
    Math.round(top) + 'px,0)';
  hole.style.width = Math.round(r.width + pad * 2) + 'px';
  hole.style.height = Math.round(height) + 'px';
  el.dataset.place = place;
}

/* ---------------- small waits ---------------- */

const frame = () => new Promise(r => requestAnimationFrame(() => r()));
/* Smooth scrolling has no completion event. Rather than guess a duration,
   watch the position until it stops moving, with a ceiling so a page that
   cannot scroll does not hold the step open. */
function settle() {
  if (RM) return Promise.resolve();
  return new Promise(resolve => {
    let last = -1, still = 0, frames = 0;
    const step = () => {
      const y = window.scrollY;
      if (y === last) still++; else { still = 0; last = y; }
      if (still > 2 || ++frames > 40) { resolve(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
}
