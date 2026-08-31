'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { SPORTS, BOOKMAKER_GROUPS } from '@/lib/data/reference';

export function SportsPicker() {
  const router = useRouter();
  const [sports, setSports] = useState<string[]>(['football']);
  const [books, setBooks] = useState<string[]>(['bet365']);
  const [openGroups, setOpenGroups] = useState<string[]>(['Other']);
  const [customName, setCustomName] = useState('');
  const [customs, setCustoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function addCustom() {
    const n = customName.trim();
    if (!n || customs.includes(n)) return;
    setCustoms([...customs, n]);
    setCustomName('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/auth/profile', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sports, bookmakers: books, customBookmakers: customs }),
    }).catch(() => null);
    router.push('/signup/plan');
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">Sports</legend>
        <div className="rows">
          {SPORTS.map((s) => {
            const on = sports.includes(s.id);
            return (
              <button key={s.id} type="button" className={`rowcard${on ? ' rowcard--on' : ''}`}
                aria-pressed={on} onClick={() => toggle(sports, setSports, s.id)} style={{ cursor: 'pointer', textAlign: 'left' }}>
                <Icon name={s.icon} size={20} className="rowcard__i" />
                <span className="grow"><span className="rowcard__t">{s.name}</span></span>
                {on ? <Icon name="check" size={18} style={{ color: 'var(--accent)' }} /> : null}
              </button>
            );
          })}
        </div>
        <p className="field__hint">These three, and only these three. Adding a fourth would mean settling a sport nobody can settle honestly yet.</p>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 'var(--s6) 0 0' }}>
        <legend className="field__label">Bookmakers</legend>
        {BOOKMAKER_GROUPS.map((g) => {
          const open = openGroups.includes(g.group);
          const chosen = g.books.filter((b) => books.includes(b.id)).length;
          return (
            <div key={g.group} style={{ borderTop: '1px solid var(--line)' }}>
              <button type="button" className="faq__q" aria-expanded={open}
                onClick={() => toggle(openGroups, setOpenGroups, g.group)}>
                <span>{g.group} {chosen ? <span className="small dim">({chosen} chosen)</span> : null}</span>
                <Icon name="plus" size={18} className="faq__i" />
              </button>
              {open ? (
                <ul style={{ paddingBottom: 'var(--s3)', display: 'grid', gap: 4 }}>
                  {g.books.map((b) => {
                    const on = books.includes(b.id);
                    return (
                      <li key={b.id}>
                        <label className="check" style={{ minHeight: 44, padding: '4px 0' }}>
                          <input type="checkbox" checked={on} onChange={() => toggle(books, setBooks, b.id)} />
                          <span className="small">
                            {b.name}
                            {b.commissionPct ? <span className="dim"> · {b.commissionPct}% commission</span> : null}
                            {b.handicapStyle === 'asian' ? <span className="dim"> · Asian handicaps</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="cb">Add one that is not listed</label>
        <div className="row" style={{ gap: 'var(--s2)', alignItems: 'stretch' }}>
          <input id="cb" className="input grow" value={customName} autoComplete="off"
            onChange={(e) => setCustomName(e.target.value)} placeholder="A local shop, or an exchange" />
          <button type="button" className="btn btn--ghost" onClick={addCustom}>Add</button>
        </div>
        {customs.length ? (
          <ul className="logstrip" style={{ marginTop: 'var(--s3)' }}>
            {customs.map((c) => (
              <li key={c}>
                <button type="button" className="pill pill--lg" onClick={() => setCustoms(customs.filter((x) => x !== c))}
                  aria-label={`Remove ${c}`} style={{ cursor: 'pointer' }}>
                  {c} <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        Continue <Icon name="arrowRight" size={16} />
      </button>
    </form>
  );
}
