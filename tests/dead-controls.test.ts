import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { newestMonthBack } from '@/lib/calendar-ramp';
import { NOTIFICATIONS, SHARING_SWITCHES, isSwitch, switchDefaults } from '@/lib/data/settings';

/** A CONTROL THAT CHANGES ONLY ITS OWN LABEL IS WORSE THAN NO CONTROL,
 *  because it teaches the person that the product lies. Three of them
 *  shipped: a delete that set a React state variable beside a privacy
 *  commitment the policy repeats, seven notification switches that saved
 *  nothing and reverted on reload, and two sidebar rows pointing at a route
 *  that does not exist. */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// ------------------------------------------------------------ the routes

/** Every address this build actually serves, with a dynamic segment left as a
 *  wildcard. Route groups in brackets are not part of a URL. */
function routeMap(): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>(['/']);
  const prefixes: string[] = [];
  for (const file of walk('app')) {
    const base = file.split('/').pop() ?? '';
    if (!/^(page|route)\.tsx?$/.test(base)) continue;
    const segments = file.split('/').slice(1, -1).filter((s) => !/^\(.*\)$/.test(s));
    const path = `/${segments.join('/')}`;
    if (segments.some((s) => s.startsWith('['))) {
      prefixes.push(`/${segments.slice(0, segments.findIndex((s) => s.startsWith('['))).join('/')}`);
    } else {
      exact.add(path === '/' ? '/' : path);
    }
  }
  // The two aliases middleware redirects rather than rewrites.
  exact.add('/404');
  exact.add('/500');
  return { exact, prefixes };
}

test('no link in the product points at a route that does not exist', () => {
  /*  AppShell:122 and :129 linked "Settlements to confirm" and "Questions to
   *  answer" to /app/review, and there is no app/app/review directory. Both
   *  rows are hidden today because attention() reports zero of each, which
   *  means the 404 was waiting for the day the ingestion branch lands and
   *  starts producing them: the worst kind of latent defect, one that appears
   *  the moment a feature starts working. */
  const { exact, prefixes } = routeMap();
  const bad: string[] = [];
  for (const file of [...walk('components'), ...walk('app')]) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('*') || line.trim().startsWith('//')) return;
      for (const m of line.matchAll(/href=(?:"|\{`)(\/[^"`\s]*)/g)) {
        /*  A template literal href carries an interpolation. Everything up to
            the first ${ is a fixed prefix and is what gets checked: a link
            built onto a real route is a real link, and one built onto a route
            that does not exist is the defect this test is for. */
        const interpolated = m[1].includes('${');
        const head = m[1].split('${')[0];
        const raw = head.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
        if (exact.has(raw)) continue;
        if (prefixes.some((p) => p && raw.startsWith(`${p}/`))) continue;
        if (interpolated && [...exact].some((r) => r.startsWith(raw))) continue;
        bad.push(`${file}:${i + 1} ${raw}`);
      }
    });
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// ----------------------------------------------------------- the switches

const PANES = readFileSync('components/app/SettingsPanes.tsx', 'utf8');
const SETTINGS_ROUTE = readFileSync('app/api/settings/route.ts', 'utf8');

test('every switch in settings sends a request rather than only relabelling itself', () => {
  /*  The seven notification toggles called setNotifs({...}) and nothing else:
   *  no save, no request, no persistence, and a reload put every one of them
   *  back. The four sharing switches posted { sharing, on } to a route that
   *  read neither field. */
  const setters = [...PANES.matchAll(/onClick=\{\(\) => setNotifs\(/g)];
  assert.deepEqual(setters.map((m) => m[0]), [], 'a notification switch still only sets local state');
  assert.match(PANES, /save\(\{ notification: n\.id, on: next \}/);
  assert.match(PANES, /save\(\{ sharing: sw\.id, on: next \}/);
});

test('the settings route stores both kinds of switch', () => {
  assert.match(SETTINGS_ROUTE, /body\.notification/);
  assert.match(SETTINGS_ROUTE, /body\.sharing/);
  assert.match(SETTINGS_ROUTE, /isSwitch\(NOTIFICATIONS/);
  assert.match(SETTINGS_ROUTE, /isSwitch\(SHARING_SWITCHES/);
  assert.match(SETTINGS_ROUTE, /jsonb_set/, 'two switches at once must not clobber each other');
});

test('a switch id the product does not know about never reaches the column', () => {
  assert.equal(isSwitch(NOTIFICATIONS, 'settled'), true);
  assert.equal(isSwitch(NOTIFICATIONS, 'anything'), false);
  assert.equal(isSwitch(SHARING_SWITCHES, 'profile'), true);
  assert.equal(isSwitch(SHARING_SWITCHES, 'notifications'), false);
});

test('the switches read back what was stored, and default from one list', () => {
  const all = switchDefaults(NOTIFICATIONS, null);
  for (const n of NOTIFICATIONS) assert.equal(all[n.id], n.on, `${n.id} did not take its default`);

  const overridden = switchDefaults(NOTIFICATIONS, { settled: false, nonsense: true });
  assert.equal(overridden.settled, false, 'a stored choice was ignored');
  assert.equal(overridden.target, NOTIFICATIONS.find((n) => n.id === 'target')?.on);
  assert.equal('nonsense' in overridden, false, 'a key the product does not know about got through');
});

test('the panes start from the account rather than from a fresh copy of the defaults', () => {
  /*  The specific reason a reload put every switch back: the pane built its
   *  own object out of the list at mount and nothing ever told it what the
   *  account had chosen. */
  assert.match(PANES, /useState\(account\.notifications\)/);
  assert.match(PANES, /useState<Record<string, boolean>>\(account\.sharing\)/);
  assert.match(PANES, /useState\(account\.onBreak\)/);
});

test('billing notices cannot be switched off, in the pane or through the route', () => {
  /*  An account that cannot be told its card failed is an account that goes
   *  read only without warning. A disabled attribute is a promise to a mouse
   *  and not to a request, so the route refuses it too. */
  assert.equal(NOTIFICATIONS.find((n) => n.id === 'billing')?.locked, true);
  assert.match(SETTINGS_ROUTE, /locked/);
});

// ------------------------------------------------------------ the calendar

test('the calendar opens on the newest month that has anything in it', () => {
  const now = { year: 2026, month: 9 };
  assert.equal(newestMonthBack([], now), 0, 'an empty account opens on this month');
  assert.equal(newestMonthBack([{ day: '2026-09-01' }], now), 0);
  assert.equal(newestMonthBack([{ day: '2026-08-31' }, { day: '2026-02-04' }], now), 1);
  assert.equal(newestMonthBack([{ day: '2025-12-30' }], now), 9, 'it crosses a year end');
  assert.equal(
    newestMonthBack([{ day: '2026-10-01' }], now), 0,
    'a day in the future never opens the calendar on a future month',
  );
});
