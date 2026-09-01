'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { initials, units as fmtUnits } from '@/lib/format';
import type { GroupSummary, Slipper } from '@/lib/data/social';

type Sort = 'popular' | 'newest' | 'az';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'az', label: 'A to Z' },
];

export function Discover({ groups, people }: { groups: GroupSummary[]; people: Slipper[] }) {
  const [tab, setTab] = useState<'groups' | 'people'>('groups');
  const [sort, setSort] = useState<Sort>('popular');
  const [q, setQ] = useState('');
  const [joined, setJoined] = useState<string[]>([]);

  const term = q.trim().toLowerCase();

  const shownGroups = useMemo(() => {
    const list = groups.filter((g) => !term || g.name.toLowerCase().includes(term) || g.id.includes(term));
    if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') return [...list].reverse();
    return [...list].sort((a, b) => b.members - a.members);
  }, [groups, term, sort]);

  const shownPeople = useMemo(() => {
    const list = people.filter((p) =>
      !term || p.name.toLowerCase().includes(term) || p.handle.includes(term));
    if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') return [...list].sort((a, b) => b.joined.localeCompare(a.joined));
    return [...list].sort((a, b) => b.bets - a.bets);
  }, [people, term, sort]);

  return (
    <>
      <div className="row row--wrap" style={{ gap: 'var(--s3)', marginBottom: 'var(--gap-block)' }}>
        <div className="seg" role="group" aria-label="What to search">
          <button type="button" className="seg__btn" aria-pressed={tab === 'groups'} onClick={() => setTab('groups')}>Groups</button>
          <button type="button" className="seg__btn" aria-pressed={tab === 'people'} onClick={() => setTab('people')}>Slippers</button>
        </div>
        <div className="seg" role="group" aria-label="Sort">
          {SORTS.map((s) => (
            <button key={s.id} type="button" className="seg__btn" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="disc-q">Search</label>
        <input id="disc-q" className="input" value={q} autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === 'groups' ? 'A group name' : 'A name or a handle'} />
      </div>

      <div className="card" style={{ marginTop: 'var(--s4)' }}>
        {tab === 'groups' ? (
          shownGroups.length === 0 ? (
            <p className="small dim">No group matches that. Group names are set once and cannot be changed, so a search is exact about what exists.</p>
          ) : (
            <ul>
              {shownGroups.map((g) => {
                const isJoined = joined.includes(g.id);
                return (
                  <li key={g.id} className="brow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                    <span style={{ minWidth: 0 }}>
                      <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                      <span className="brow__sub" style={{ display: 'block' }}>
                        {g.members} Slippers · {g.division} · {g.joinMode === 'open' ? 'open to anyone' : g.joinMode === 'code' ? 'by invite code' : 'approval needed'}
                      </span>
                      <span className="brow__sub" style={{ display: 'block' }}>{g.blurb}</span>
                    </span>
                    <button
                      type="button"
                      className={`btn btn--sm ${isJoined ? 'btn--ghost' : 'btn--primary'}`}
                      aria-pressed={isJoined}
                      onClick={() => setJoined(isJoined ? joined.filter((x) => x !== g.id) : [...joined, g.id])}
                    >
                      <Icon name={isJoined ? 'check' : 'plus'} size={15} />
                      {isJoined ? 'Requested' : g.joinMode === 'approval' ? 'Ask to join' : 'Join'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          shownPeople.length === 0 ? (
            <p className="small dim">No Slipper matches that.</p>
          ) : (
            <ul>
              {shownPeople.map((p) => (
                <li key={p.handle} className="brow" style={{ gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                  <span className="avatar" aria-hidden="true">{initials(p.name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/app/social/person?handle=${p.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>{p.name}</Link>
                    <span className="brow__sub" style={{ display: 'block' }}>
                      <span className="mono">@{p.handle}</span> · {p.slipBackedPct}% slip backed · {p.bets} bets
                    </span>
                  </span>
                  <span className={`fig fig--s tnum ${p.unitsAllTime >= 0 ? 'pos' : 'neg'}`}>
                    {fmtUnits(p.unitsAllTime, { league: true, sign: true })}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
        Joining a group is a request, not an instruction: an approval group tells its admin, and an
        open one adds you straight away.
      </p>
    </>
  );
}
