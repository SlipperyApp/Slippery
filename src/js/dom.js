/* Small DOM helpers. Deliberately tiny, this app has no framework and
   does not want one. */

export const $ = id => document.getElementById(id);
export const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

/* Guarded so this module can be imported outside a browser. The tests run
   in node, and a module that reads matchMedia at import time makes every
   module that transitively imports it untestable — which is how the
   content modules came to have no unit tests at all. In a browser the
   value is unchanged. */
export const RM = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Escape anything that came from a user or an API before it touches innerHTML. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }

export function setText(id, text) { const e = $(id); if (e) e.textContent = text; }
export function setHTML(id, html) { const e = $(id); if (e) e.innerHTML = html; }

/** Announce to screen readers without moving focus. */
export function announce(msg) { const e = $('announcer'); if (e) e.textContent = msg; }

export function toast(msg) {
  announce(msg);
  const wrap = $('toasts');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.className = 'toast leaving';
    setTimeout(() => t.remove(), 220);
  }, 2600);
}

/** Collapse an element away rather than letting it vanish mid-glance. */
export function collapse(el, msg) {
  if (!el || el.classList.contains('collapsing')) return;
  el.classList.add('collapsing');
  setTimeout(() => { el.style.display = 'none'; }, RM ? 20 : 430);
  if (msg) toast(msg);
}

/** Position a segmented control's sliding thumb.
    Measured, so it must only run while the control is actually laid out,
    calling it inside a display:none pane gives offsetWidth 0 and a thumb
    scaled to nothing. Every caller re-runs it when its pane is shown. */
/* THE SEGMENTED CONTROL.
 *
 * One component, one selected state, one thumb. The selection used to be
 * marked three different ways — a class, aria-pressed and aria-selected —
 * because three controls had grown up separately, and paintSeg had to
 * query for all three.
 *
 * The thumb is measured rather than computed in CSS because the buttons
 * are content-width, so its position is only knowable after layout. That
 * is also what made it fragile: measuring inside a hidden pane returns
 * zero, paintSeg returned early, and the thumb stayed at its 100px CSS
 * default sitting over the first button. Seven call sites re-ran it by
 * hand to work around that, and each one was a place somebody had to
 * remember.
 *
 * A ResizeObserver replaces all seven. A pane going from hidden to visible
 * is a resize from zero, so the control repaints itself the moment it can
 * be measured, whoever revealed it.
 */
const SEG_SEL = 'button.on, button[aria-pressed="true"], button[aria-selected="true"]';
const watched = new WeakSet();
const segRO = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => { for (const e of entries) paint(e.target); })
  : null;

function paint(container) {
  let thumb = container.querySelector(':scope > .thumb');
  const active = container.querySelector(SEG_SEL);
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.setAttribute('aria-hidden', 'true');
    container.insertBefore(thumb, container.firstChild);
  }
  /* Nothing measurable yet. Leaving the thumb hidden rather than parked
     over the first button means a control that is never revealed does not
     show a selection it does not have. */
  if (!active || !active.offsetWidth) { thumb.style.opacity = '0'; return; }
  thumb.style.opacity = '';
  thumb.style.transform =
    'translateX(' + (active.offsetLeft - container.clientLeft) + 'px) scaleX(' +
    (active.offsetWidth / 100) + ')';
}

export function paintSeg(container) {
  if (!container) return;
  if (segRO && !watched.has(container)) { watched.add(container); segRO.observe(container); }
  paint(container);
}

/**
 * Move the selection in a segmented control and repaint it. One place that
 * knows how a segment marks itself selected, so a new control cannot mark
 * itself a fourth way.
 */
export function selectSeg(container, button) {
  if (!container || !button) return;
  const tabs = button.getAttribute('role') === 'tab';
  $$('button', container).forEach(b => {
    const on = b === button;
    b.classList.toggle('on', on);
    b.setAttribute(tabs ? 'aria-selected' : 'aria-pressed', String(on));
  });
  paintSeg(container);
}

export function paintSegs(root) { $$('.seg', root || document).forEach(paintSeg); }

/** Reveal-on-scroll. One observer for the whole app. */
const io = typeof window !== 'undefined' && window.IntersectionObserver
  ? new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 })
  : null;
export function reveal(scope) {
  const els = $$('.reveal', scope || document);
  if (!io) els.forEach(e => e.classList.add('shown'));
  else els.forEach(e => { if (!e.classList.contains('shown')) io.observe(e); });
}

/** Trap focus inside an open dialog. Returns a teardown function. */
export function trapFocus(dialog) {
  const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const items = $$(sel, dialog).filter(x => !x.disabled && x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
