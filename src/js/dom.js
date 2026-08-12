/* Small DOM helpers. Deliberately tiny, this app has no framework and
   does not want one. */

export const $ = id => document.getElementById(id);
export const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
export function paintSeg(container) {
  if (!container) return;
  let thumb = container.querySelector(':scope > .thumb');
  const active = container.querySelector('button.on, button[aria-selected="true"]');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.setAttribute('aria-hidden', 'true');
    container.insertBefore(thumb, container.firstChild);
  }
  if (!active || !active.offsetWidth) return;
  thumb.style.transform =
    'translateX(' + (active.offsetLeft - container.clientLeft) + 'px) scaleX(' +
    (active.offsetWidth / 100) + ')';
}
export function paintSegs(root) { $$('.seg', root || document).forEach(paintSeg); }

/** Reveal-on-scroll. One observer for the whole app. */
const io = window.IntersectionObserver
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
