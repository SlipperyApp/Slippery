/* WHAT THE BROWSER REMEMBERS.
 *
 * One versioned key holding the preferences a visitor can set before they
 * have an account. A signed-in account keeps the same preferences on the
 * server, and the server wins on load: the local copy is a convenience for
 * people who have not signed up, and a cache for the moment before /api/me
 * answers, never a second source of truth.
 *
 * STORAGE CAN FAIL AND THE APP MUST NOT. Private browsing on iOS throws on
 * write. A full quota throws. A browser set to block site data throws on
 * read. Every path here is wrapped, and every failure degrades to "this
 * session only" rather than to a blank screen.
 */
const KEY = 'slippery.state.v1';

/* Only these travel. Anything else in `cur` is view state that would be
   wrong to restore: which sheet was open, which bet was being looked at. */
const PERSIST = [
  'theme', 'oddsFmt', 'showIn', 'weekStart', 'calDates', 'per',
  'unit', 'target', 'bankroll', 'order', 'above', 'adaptBr',
];

let available = null;

/** Whether storage works at all, decided once by trying it. */
export function storageWorks() {
  if (available !== null) return available;
  try {
    const probe = '__slippery_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/* Migrations, oldest first. A stored blob names its own version, so a person
   who last opened the app three versions ago is walked forward rather than
   having their settings silently dropped. */
const MIGRATIONS = {
  /* v1 is the first. The next one goes here as `2: (s) => ({...})`, and
     CURRENT goes up with it. */
};
const CURRENT = 1;

export function load() {
  if (!storageWorks()) return {};
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return {}; }
  if (!raw) return {};

  let blob;
  try { blob = JSON.parse(raw); } catch {
    /* Corrupt rather than absent. Dropped, because guessing at half a JSON
       document is how somebody's theme becomes undefined. */
    try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
    return {};
  }

  let { v = 0, state = {} } = blob;
  while (v < CURRENT && MIGRATIONS[v + 1]) { state = MIGRATIONS[v + 1](state); v++; }
  if (v !== CURRENT) return {};

  /* Only the keys this version knows. A key removed from PERSIST stops being
     restored the moment it is removed, without a migration to delete it. */
  const out = {};
  for (const k of PERSIST) if (k in state) out[k] = state[k];
  return out;
}

export function save(cur) {
  if (!storageWorks()) return false;
  const state = {};
  for (const k of PERSIST) if (cur[k] !== undefined) state[k] = cur[k];
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: CURRENT, state }));
    return true;
  } catch {
    /* Quota, or a browser that allows a read and refuses a write. The
       setting still applies to this session; it just will not survive a
       reload, and nothing about that is worth interrupting somebody for. */
    available = false;
    return false;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* already gone, or unreachable */ }
}

/* Read before the first paint so there is no flash of the default theme.
   Returns the theme alone, because that is the only stored value that has to
   be applied before anything is drawn. */
export function themeBeforePaint() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { state } = JSON.parse(raw);
    return state && typeof state.theme === 'string' ? state.theme : null;
  } catch {
    return null;
  }
}
