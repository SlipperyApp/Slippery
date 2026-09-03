'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** Making a group, which the product promised in three places and did
 *  nowhere.
 *
 *  The marketing page says "Name it, choose open or by code, and share the
 *  code". The social hub offered "Find a group". The empty state said "A
 *  group takes about a minute to start" and then offered no way to start
 *  one. Every path that should have ended in a group ended in discovery,
 *  which is the one thing a person with no group cannot use.
 *
 *  THREE DECISIONS, AND ONE OF THEM IS PERMANENT. Name, who can join, and
 *  what the table is ranked over. The name cannot be changed afterwards
 *  because a group's name is how its members refer to it in a chat that
 *  Slippery cannot see, and that is said here, before it is typed, rather
 *  than in a confirmation nobody reads.
 *
 *  TWO THINGS ARE NOT DECISIONS and they are shown as settled facts rather
 *  than as switches somebody has to think about: a table ranks in units, so
 *  a £5 bettor and a £500 bettor are comparable, and only slip-backed bets
 *  count in it. An admin who could turn the second one off could build a
 *  league table out of typed-in winners, which is the one thing this
 *  feature exists to prevent. */

const JOIN = [
  { id: 'open', label: 'Anyone can join', sub: 'It shows in Discover and there is nothing to approve.' },
  { id: 'code', label: 'With the code', sub: 'You share a six character code. Anybody who has it is in.' },
  { id: 'approval', label: 'You approve each one', sub: 'It shows in Discover, and requests come to you.' },
] as const;

const PERIOD = [
  { id: 'month', label: 'The month' },
  { id: 'year', label: 'The year' },
  { id: 'all', label: 'All time' },
] as const;

export function CreateGroup() {
  const [name, setName] = useState('');
  const [joinMode, setJoinMode] = useState<'open' | 'code' | 'approval'>('code');
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'local'>('idle');
  const [code, setCode] = useState('');

  const trimmed = name.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 3;
  const ready = trimmed.length >= 3 && state !== 'saving';

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setState('saving');
    const res = await fetch('/api/social/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed, joinMode, rankingPeriod: period }),
    }).catch(() => null);
    const body = res && res.ok ? await res.json().catch(() => null) : null;
    /*  A code is shown either way, because the screen's job is to get you to
        the point where you can invite somebody. Signed out, it is generated
        here and the copy says so rather than implying the group exists. */
    setCode(body?.inviteCode ?? localCode(trimmed));
    setState(res && res.ok ? 'done' : 'local');
  }

  if (state === 'done' || state === 'local') {
    return (
      <div className="card">
        <h2 className="card__title">{trimmed}</h2>
        <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
          {state === 'done'
            ? 'The group is yours and you are its admin.'
            : 'Made here, on this device. Signed in, this is the point where the group is created and the code is yours.'}
        </p>

        <p className="label" style={{ marginTop: 'var(--s5)' }}>The code to share</p>
        <p className="fig fig--m mono" style={{ letterSpacing: '0.12em' }}>{code}</p>
        <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
          {joinMode === 'approval'
            ? 'Anybody with this asks to join, and the request comes to you.'
            : joinMode === 'code'
              ? 'Anybody with this is in. Anyone already in the group can pass it on.'
              : 'The group is open, so this is a shortcut rather than a key.'}
        </p>

        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          <Link href="/app/social" className="btn btn--primary btn--sm">
            <Icon name="social" size={16} /> Go to your groups
          </Link>
          <Link href="/app/social/discover" className="btn btn--quiet btn--sm">Find more people</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={create}>
      <div className="field field--name">
        <label className="field__label" htmlFor="g-name">What is it called</label>
        <input
          id="g-name" className="input" value={name} maxLength={40} autoComplete="off"
          placeholder="Sunday league"
          onChange={(e) => setName(e.target.value)}
          aria-describedby="g-name-hint"
        />
        <p className="field__hint" id="g-name-hint">
          {tooShort
            ? 'Three characters or more.'
            : 'This cannot be changed later. Members will refer to it in a group chat Slippery never sees.'}
        </p>
      </div>

      <fieldset className="fieldset" style={{ marginTop: 'var(--s5)' }}>
        <legend className="label">Who can join</legend>
        {/*  THE SETTINGS LIST, which is the product's answer to picking one
             of three: one frame, a rule between the rows and the chosen row
             filled with a bar on its leading edge. This was .optionset, a
             third implementation of the same control after .navlist and the
             importer's, drawn as three separately outlined boxes with gaps
             inside a card that is already a box. */}
        <div className="navlist">
          {JOIN.map((o) => (
            <button
              key={o.id} type="button" className="rowcard"
              aria-pressed={joinMode === o.id}
              onClick={() => setJoinMode(o.id)}
            >
              <span>
                <span className="rowcard__t">{o.label}</span>
                <span className="rowcard__s">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset" style={{ marginTop: 'var(--s5)' }}>
        <legend className="label">The table covers</legend>
        <div className="seg" role="group" aria-label="Ranking period">
          {PERIOD.map((p) => (
            <button
              key={p.id} type="button" className="seg__btn"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/*  Facts, not switches. An admin who could turn slip-backed off could
           build a table out of typed-in winners. */}
      <ul className="factlist" style={{ marginTop: 'var(--s5)' }}>
        <li><Icon name="check" size={16} /><span>Ranked in units, so a £5 stake and a £500 stake compare directly.</span></li>
        <li><Icon name="check" size={16} /><span>Slip-backed bets only. Imported and typed-in bets never enter a table.</span></li>
        <li><Icon name="check" size={16} /><span>Members see each other&rsquo;s unit size. Nobody outside the group does.</span></li>
        <li><Icon name="check" size={16} /><span>You are the admin, and you can hand that over or delete the group.</span></li>
      </ul>

      <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn--primary" disabled={!ready}>
          {state === 'saving' ? 'Creating…' : 'Create the group'}
        </button>
        <Link href="/app/social" className="btn btn--quiet">Cancel</Link>
      </div>
    </form>
  );
}

/*  Six characters from the SAME alphabet lib/server/codes.ts issues from,
    because this gets read aloud and typed from a photograph of a screen.

    It used to be its own set, which included L and therefore could produce a
    code that `isInviteCode()` rejects: a person who wrote down the code this
    screen gave them would have been told, on the join screen, that no group
    has it. One format and one validator, and a test asserts these two
    literals stay the same string. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function localCode(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let out = '';
  for (let i = 0; i < 6; i += 1) { h = Math.imul(h ^ (h >>> 13), 16777619); out += ALPHABET[Math.abs(h) % ALPHABET.length]; }
  return out;
}
