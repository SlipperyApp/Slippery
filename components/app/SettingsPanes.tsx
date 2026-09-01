'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/components/ThemeProvider';
import { THEMES } from '@/lib/themes';
import { NOTIFICATIONS, NEVER_SENT, type SettingsGroup } from '@/lib/data/settings';
import { ALL_BOOKMAKERS, MARKET_GROUPS } from '@/lib/data/reference';
import { money, units as fmtUnits } from '@/lib/format';
import { formatOdds } from '@/lib/odds';
import type { Currency } from '@/lib/domain/types';

type Account = {
  displayName: string; handle: string; email: string;
  unitPence: number; currency: Currency; weekStart: 0 | 1;
  oddsFormat: 'decimal' | 'fractional' | 'american';
  showProfitIn: 'currency' | 'units' | 'both';
  calendarDates: boolean; bankrollStartPence: number;
};

/** Six groups, each opening a detail pane. Every control changes something
 *  visible on this page, so none of them is a preference nothing reads. */
export function SettingsPanes({ groups, account }: { groups: SettingsGroup[]; account: Account }) {
  const [open, setOpen] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const [unitPence, setUnitPence] = useState(account.unitPence);
  const [currency, setCurrency] = useState<Currency>(account.currency);
  const [oddsFormat, setOddsFormat] = useState(account.oddsFormat);
  const [showProfitIn, setShowProfitIn] = useState(account.showProfitIn);
  const [weekStart, setWeekStart] = useState<0 | 1>(account.weekStart);
  const [calendarDates, setCalendarDates] = useState(account.calendarDates);
  const [notifs, setNotifs] = useState(() => Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, n.on])));
  const [onBreak, setOnBreak] = useState(false);
  const [typed, setTyped] = useState('');
  const [danger, setDanger] = useState<'reset' | 'delete' | null>(null);
  const [saved, setSaved] = useState('');

  async function save(patch: Record<string, unknown>, label: string) {
    setSaved('');
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setSaved(res && res.ok ? `${label} saved.` : `${label} changed here. Signed in, it saves to your account.`);
  }

  const sampleProfit = 900;
  const profitPreview = showProfitIn === 'units'
    ? fmtUnits(sampleProfit / unitPence, { sign: true })
    : showProfitIn === 'both'
      ? `${money(sampleProfit, currency, { sign: true })} · ${fmtUnits(sampleProfit / unitPence, { sign: true })}`
      : money(sampleProfit, currency, { sign: true });

  return (
    <div className="grid">
      <div className="col-4" style={{ display: 'grid', gap: 'var(--s2)', alignContent: 'start' }}>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className="rowcard"
            aria-pressed={open === g.id}
            aria-controls="settings-pane"
            onClick={() => setOpen(open === g.id ? null : g.id)}
            style={{
              cursor: 'pointer', textAlign: 'left', width: '100%',
              ...(open === g.id ? { borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))' } : {}),
            }}
          >
            <Icon name={g.icon} size={20} className="rowcard__i" />
            <span className="grow">
              <span className="rowcard__t">{g.label}</span>
              <span className="rowcard__s">{g.blurb}</span>
            </span>
            <Icon name="chevronRight" size={16} className="rowcard__i" />
          </button>
        ))}
      </div>

      <div className="col-8" id="settings-pane" aria-live="polite">
        {open === null ? (
          <div className="card">
            <p className="card__title">Pick a group</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '52ch' }}>
              Six groups rather than thirty three flat rows, because settings is rarely visited and
              a wall of switches is where a dead control goes to hide.
            </p>
            <div className="hr" />
            <p className="label">Right now</p>
            <ul style={{ marginTop: 'var(--s3)' }}>
              <li className="brow"><span className="brow__title">Unit</span><span className="fig fig--s tnum">{money(unitPence, currency)}</span></li>
              <li className="brow"><span className="brow__title">A profit of {money(sampleProfit, currency)} reads as</span><span className="fig fig--s tnum">{profitPreview}</span></li>
              <li className="brow"><span className="brow__title">A price of 1.90 reads as</span><span className="fig fig--s mono">{formatOdds(1.9, oddsFormat)}</span></li>
              <li className="brow"><span className="brow__title">Week starts</span><span className="fig fig--s">{weekStart === 1 ? 'Monday' : 'Sunday'}</span></li>
              <li className="brow"><span className="brow__title">Theme</span><span className="fig fig--s">{THEMES.find((t) => t.name === theme)?.label}</span></li>
            </ul>
          </div>
        ) : null}

        {open === 'account' ? (
          <div className="card">
            <h2 className="card__title">Account</h2>
            <div className="field">
              <label className="field__label" htmlFor="st-name">Display name</label>
              <input id="st-name" className="input" defaultValue={account.displayName} autoComplete="name" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="st-handle">Handle</label>
              <input id="st-handle" className="input mono" defaultValue={account.handle} autoComplete="username" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="st-email">Email</label>
              <input id="st-email" className="input" type="email" defaultValue={account.email} autoComplete="email" />
              <span className="field__hint">Changing this sends a code to the new address before it takes effect.</span>
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => save({}, 'Account')}>
              Save these
            </button>

            <div className="hr" />
            <h3 className="card__title">Take a break</h3>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Pauses every notification and takes you out of the monthly leagues. Your ledger,
              your history and your export are untouched.
            </p>
            <div className="switchrow">
              <span className="brow__title">{onBreak ? 'On a break' : 'Not on a break'}</span>
              <button type="button" className="switch" aria-pressed={onBreak}
                aria-label={`Take a break: ${onBreak ? 'on' : 'off'}`}
                onClick={() => { setOnBreak(!onBreak); save({ break: !onBreak }, 'Break'); }} />
            </div>
            {onBreak ? (
              <p className="small muted">
                Turn it back on whenever you want. Nothing will ask you to.
              </p>
            ) : null}
            <p className="small dim card__foot">
              Free and confidential help is at <a href="https://www.begambleaware.org" rel="noopener noreferrer" target="_blank">BeGambleAware.org</a>{' '}
              and on 0808 8020 133, 24 hours a day.
            </p>
          </div>
        ) : null}

        {open === 'betting' ? (
          <div className="card">
            <h2 className="card__title">Betting</h2>

            <div className="field">
              <label className="field__label" htmlFor="st-unit">Unit size</label>
              <input id="st-unit" className="input input--money" inputMode="decimal"
                value={(unitPence / 100).toFixed(2)}
                onChange={(e) => setUnitPence(Math.max(10, Math.round(Number(e.target.value.replace(/[^0-9.]/g, '')) * 100) || 10))} />
              <span className="field__hint">
                Bets already logged keep the unit they were logged with, so your history never
                rewrites itself.
              </span>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 'var(--s4) 0 0' }}>
              <legend className="field__label">Currency</legend>
              <div className="seg" role="group" aria-label="Currency">
                {(['GBP', 'EUR'] as Currency[]).map((c) => (
                  <button key={c} type="button" className="seg__btn" aria-pressed={currency === c}
                    onClick={() => { setCurrency(c); save({ currency: c }, 'Currency'); }}>
                    {c === 'GBP' ? '£ Pounds' : '€ Euro'}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 'var(--s4) 0 0' }}>
              <legend className="field__label">Odds format</legend>
              <div className="seg" role="group" aria-label="Odds format">
                {(['decimal', 'fractional', 'american'] as const).map((f) => (
                  <button key={f} type="button" className="seg__btn" aria-pressed={oddsFormat === f}
                    onClick={() => { setOddsFormat(f); save({ oddsFormat: f }, 'Odds format'); }}>
                    {f === 'decimal' ? 'Decimal' : f === 'fractional' ? 'Fractional' : 'American'}
                  </button>
                ))}
              </div>
              <p className="field__hint">
                1.90 reads as <span className="mono">{formatOdds(1.9, oddsFormat)}</span>, 2.50 as{' '}
                <span className="mono">{formatOdds(2.5, oddsFormat)}</span>. From a real ladder, not
                a fraction reducer.
              </p>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 'var(--s4) 0 0' }}>
              <legend className="field__label">Show profit in</legend>
              <div className="seg" role="group" aria-label="Show profit in">
                {(['currency', 'units', 'both'] as const).map((f) => (
                  <button key={f} type="button" className="seg__btn" aria-pressed={showProfitIn === f}
                    onClick={() => { setShowProfitIn(f); save({ showProfitIn: f }, 'Profit display'); }}>
                    {f === 'currency' ? 'Money' : f === 'units' ? 'Units' : 'Both'}
                  </button>
                ))}
              </div>
              <p className="field__hint">
                A {money(sampleProfit, currency)} win reads as <strong>{profitPreview}</strong>.
              </p>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 'var(--s4) 0 0' }}>
              <legend className="field__label">Week starts on</legend>
              <div className="seg" role="group" aria-label="Week starts on">
                {([[1, 'Monday'], [0, 'Sunday']] as const).map(([v, l]) => (
                  <button key={l} type="button" className="seg__btn" aria-pressed={weekStart === v}
                    onClick={() => { setWeekStart(v); save({ weekStart: v }, 'Week start'); }}>{l}</button>
                ))}
              </div>
              <p className="field__hint">
                Day letters read {weekStart === 1 ? 'M T W T F S S' : 'S M T W T F S'} on the calendar,
                and weekly totals recompute to match.
              </p>
            </fieldset>

            <div className="switchrow" style={{ marginTop: 'var(--s4)' }}>
              <span style={{ minWidth: 0 }}>
                <span className="brow__title" style={{ display: 'block' }}>Date numbers on the calendar</span>
                <span className="brow__sub">Off leaves the colour and nothing else.</span>
              </span>
              <button type="button" className="switch" aria-pressed={calendarDates}
                aria-label={`Calendar date numbers: ${calendarDates ? 'on' : 'off'}`}
                onClick={() => { setCalendarDates(!calendarDates); save({ calendarDates: !calendarDates }, 'Calendar'); }} />
            </div>

            <button type="button" className="btn btn--ghost card__foot" onClick={() => save({ unitPence }, 'Unit')}>
              Save the unit
            </button>
            {saved ? <p className="small muted" role="status">{saved}</p> : null}
          </div>
        ) : null}

        {open === 'data' ? (
          <div className="card">
            <h2 className="card__title">Data</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Export works in read only and after cancelling, because a betting record belongs to
              the person who kept it.
            </p>
            <div className="row row--wrap" style={{ gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
              {(['csv', 'json', 'pdf'] as const).map((f) => (
                <a key={f} className="btn btn--ghost btn--sm" href={`/api/export?format=${f}`}>
                  <Icon name="download" size={15} /> {f.toUpperCase()}
                </a>
              ))}
            </div>

            <div className="hr" />
            <p className="label">Slip images</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Deleted 90 days after upload, or immediately if you ask. The bet stays and the gallery
              says the image was removed rather than showing a broken thumbnail.
            </p>
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--s3)' }}
              onClick={() => save({ purgeImages: true }, 'Image purge')}>
              Delete every slip image now
            </button>

            <div className="hr hr--strong" />
            <p className="label neg">Destructive</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Both need the word typed out. Neither can be undone, and both offer an export first.
            </p>

            <div className="field">
              <label className="field__label" htmlFor="st-typed">
                Type {danger === 'delete' ? 'DELETE' : 'RESET'} to confirm
              </label>
              <input id="st-typed" className="input mono" value={typed} autoComplete="off"
                onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder={danger === 'delete' ? 'DELETE' : 'RESET'} />
            </div>

            <div className="row row--wrap" style={{ gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
              <button type="button" className="btn btn--danger btn--sm"
                aria-pressed={danger === 'reset'}
                disabled={typed !== 'RESET'}
                onClick={() => { setDanger('reset'); save({ reset: true }, 'Reset'); }}>
                Reset the ledger, keep the account
              </button>
              <button type="button" className="btn btn--danger btn--sm"
                aria-pressed={danger === 'delete'}
                disabled={typed !== 'DELETE'}
                onClick={() => { setDanger('delete'); save({ deleteAccount: true }, 'Deletion'); }}>
                Delete the account
              </button>
            </div>
            {saved ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{saved}</p> : null}
          </div>
        ) : null}

        {open === 'sharing' ? (
          <div className="card">
            <h2 className="card__title">Sharing</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Outside a group only units are ever visible, never stakes. Inside a group, members
              see each other&rsquo;s unit size and that cannot be turned off while you are a member,
              because a comparison without it means nothing.
            </p>
            {[
              ['Profile visible to other Slippers', 'Your units, your slip backed percentage and your groups.'],
              ['Anybody can follow you', 'Off means a follow is a request.'],
              ['Show my late edits in groups', 'A group can require this anyway.'],
            ].map(([t, s]) => (
              <div key={t} className="switchrow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title" style={{ display: 'block' }}>{t}</span>
                  <span className="brow__sub">{s}</span>
                </span>
                <button type="button" className="switch" aria-pressed
                  aria-label={`${t}: on`} onClick={() => save({ sharing: t }, 'Sharing')} />
              </div>
            ))}
          </div>
        ) : null}

        {open === 'organising' ? (
          <div className="card">
            <h2 className="card__title">Organising</h2>
            <p className="label" style={{ marginTop: 'var(--s4)' }}>Bookmakers and commission</p>
            <ul style={{ marginTop: 'var(--s2)' }}>
              {ALL_BOOKMAKERS.slice(0, 8).map((b) => (
                <li key={b.id} className="brow">
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{b.name}</span>
                    <span className="brow__sub">
                      {b.group} · {b.handicapStyle === 'asian' ? 'Asian handicaps, a whole line pushes' : 'European handicaps, the handicap draw is its own outcome'}
                    </span>
                  </span>
                  <span className="small mono dim">{(b.commissionPct ?? 0).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="small dim">
              The handicap convention is a lookup per bookmaker, never a hardcode, which is why a
              -1 at bet365 and a -1 at Sky Bet settle differently on the same scoreline.
            </p>

            <div className="hr" />
            <p className="label">Market groups</p>
            <ul style={{ marginTop: 'var(--s2)' }}>
              {MARKET_GROUPS.slice(0, 6).map((g) => (
                <li key={g.id} className="brow">
                  <span className="brow__title">{g.name}</span>
                  <span className="small dim">{g.aliases.length} aliases</span>
                </li>
              ))}
            </ul>
            <p className="small dim">
              Aliases collapse each bookmaker&rsquo;s own wording, so the By market breakdown is not
              thirty rows of the same thing.
            </p>
          </div>
        ) : null}

        {open === 'about' ? (
          <div className="card">
            <h2 className="card__title">About</h2>

            <p className="label" style={{ marginTop: 'var(--s4)' }}>Theme</p>
            <ul className="grid" style={{ marginTop: 'var(--s2)', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {THEMES.map((t) => (
                <li key={t.name}>
                  <button type="button" className="wall__btn" aria-pressed={theme === t.name}
                    onClick={() => setTheme(t.name)}
                    style={theme === t.name ? { borderColor: 'var(--accent)' } : undefined}>
                    <span className="wall__n">{t.label}</span>
                    <span className="themecard__swatches" aria-hidden="true">
                      {t.swatch.map((c) => <span key={c} className="themecard__sw" style={{ background: c, width: 18, height: 18 }} />)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="small dim">
              Eight, all dark. Switching fades out for 190ms, swaps, and fades back; colour is
              never tweened, or text goes unreadable through the middle.
            </p>

            <div className="hr" />
            <p className="label">Notifications</p>
            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="switchrow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title" style={{ display: 'block' }}>{n.label}</span>
                  {n.note ? <span className="brow__sub">{n.note}</span> : null}
                </span>
                <button
                  type="button" className="switch" aria-pressed={notifs[n.id]}
                  aria-label={`${n.label}: ${notifs[n.id] ? 'on' : 'off'}${n.locked ? ', locked on' : ''}`}
                  disabled={n.locked}
                  style={n.locked ? { cursor: 'not-allowed', borderStyle: 'dashed' } : undefined}
                  onClick={() => setNotifs({ ...notifs, [n.id]: !notifs[n.id] })}
                />
              </div>
            ))}
            <p className="label" style={{ marginTop: 'var(--s5)' }}>Never sent, whatever you switch on</p>
            <ul style={{ marginTop: 'var(--s2)' }}>
              {NEVER_SENT.map((t) => (
                <li key={t} className="checkitem" style={{ padding: '5px 0' }}>
                  <Icon name="close" size={14} style={{ color: 'var(--neg)' }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="hr" />
            <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
              <Link href="/changelog" className="btn btn--ghost btn--sm">What changed</Link>
              <Link href="/terms" className="btn btn--quiet btn--sm">Terms</Link>
              <Link href="/privacy" className="btn btn--quiet btn--sm">Privacy</Link>
              <Link href="/safer-gambling" className="btn btn--quiet btn--sm">Safer gambling</Link>
              <a href="/api/sources" className="btn btn--quiet btn--sm">What this deployment can reach</a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
