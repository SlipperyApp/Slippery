'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { plural } from '@/lib/format';

/** What an admin may change, and what leaving does.
 *
 *  THE THREE JOIN MODES SAY WHAT THEY DO, in the row, at the moment of
 *  choosing. The group page previously printed one line naming the mode, so
 *  the difference between "anybody with the code is in" and "the request
 *  comes to you" existed only in whoever set it up's memory.
 *
 *  THE NAME AND THE SLIP BACKED RULE ARE NOT HERE. The name is what members
 *  call the group in a chat Slippery cannot see, and it is said before it is
 *  typed that it cannot be changed. The slip backed rule is what stops a
 *  table being built out of typed-in winners, and an admin who could switch
 *  it off could do exactly that to a table other people are already in. */

const JOIN = [
  { id: 'open', label: 'Anyone can join', sub: 'It shows in Discover and there is nothing to approve.' },
  { id: 'code', label: 'With the code', sub: 'Anybody holding the six characters is in, and any member can pass them on.' },
  { id: 'approval', label: 'You approve each one', sub: 'It shows in Discover, and every request comes to you.' },
] as const;

export function GroupSettings({
  id, joinMode, showEditAudit,
}: { id: string; joinMode: 'open' | 'code' | 'approval'; showEditAudit: boolean }) {
  const [mode, setMode] = useState(joinMode);
  const [edits, setEdits] = useState(showEditAudit);
  const [said, setSaid] = useState('');

  async function patch(body: Record<string, unknown>, label: string) {
    setSaid('');
    const res = await fetch('/api/social/groups', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    }).catch(() => null);
    setSaid(res && res.ok ? `${label} saved.` : `${label} changed here. Signed in, it saves to the group.`);
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">You run this one</h2>
        <p className="card__note">Admin</p>
      </div>

      <fieldset className="fieldset" style={{ marginTop: 'var(--s4)' }}>
        <legend className="label">Who can join</legend>
        <div className="optionset">
          {JOIN.map((o) => (
            <button
              key={o.id} type="button" className="optionrow"
              aria-pressed={mode === o.id}
              onClick={() => { setMode(o.id); patch({ joinMode: o.id }, 'Who can join'); }}
            >
              <span className="optionrow__t">{o.label}</span>
              <span className="optionrow__s">{o.sub}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="switchrow" style={{ marginTop: 'var(--s4)' }}>
        <span style={{ minWidth: 0 }}>
          <span className="brow__title" style={{ display: 'block' }}>Show late edits on the board</span>
          <span className="brow__sub">A late edit is a settlement entered after the result was known.</span>
        </span>
        <button
          type="button" className="switch"
          aria-pressed={edits}
          aria-label={`Show late edits: ${edits ? 'on' : 'off'}`}
          onClick={() => { const next = !edits; setEdits(next); patch({ showEditAudit: next }, 'Late edits'); }}
        />
      </div>

      {said ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{said}</p> : null}

      <p className="small dim card__foot">
        The name and the slip backed rule stay as they were set. Members refer to the name in a
        chat this product never sees, and a table that could stop counting slips is a table of
        whatever people typed in.
      </p>
    </section>
  );
}

/** Leaving, and what it does to your figures, which is nothing.
 *
 *  Two steps, because a table somebody is fourteen months into is not a
 *  thing to fall out of on one tap. */
export function LeaveGroup({
  id, name, members, youOwn,
}: { id: string; name: string; members: number; youOwn: boolean }) {
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<'in' | 'out'>('in');
  const [said, setSaid] = useState('');

  if (youOwn) {
    return (
      <p className="small dim">
        You are the admin of {name}. Hand that over to another member first: a group whose admin
        has left is a group nobody can change.
      </p>
    );
  }

  if (state === 'out') {
    return (
      <p className="small muted" role="status">
        You have left {name}. Your figures are unchanged, because they are folded from your own
        ledger and were never the group&rsquo;s. {name} is {plural(members - 1, 'Slipper')} now.
        {said ? ` ${said}` : ''}
      </p>
    );
  }

  async function leave() {
    const res = await fetch('/api/social/membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'leave', groupId: id }),
    }).catch(() => null);
    setSaid(res && res.ok ? '' : 'Signed in, this leaves the group on your account too.');
    setState('out');
  }

  return asking ? (
    <div>
      <p className="small muted">
        Leave {name}? Your units, your return and your record stay exactly as they are: they are
        counted from your own bets, not from the group. The group goes to {plural(members - 1, 'Slipper')}
        and your row comes off its board.
      </p>
      <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--sm btn--ghost" onClick={leave}>Leave the group</button>
        <button type="button" className="btn btn--sm btn--quiet" onClick={() => setAsking(false)}>Stay</button>
      </div>
    </div>
  ) : (
    <button type="button" className="btn btn--sm btn--quiet" onClick={() => setAsking(true)}>
      <Icon name="close" size={15} /> Leave this group
    </button>
  );
}
