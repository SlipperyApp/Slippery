'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

export function HistoryUpload() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [rows, setRows] = useState(0);
  const [error, setError] = useState('');

  async function take(file: File | undefined) {
    if (!file) return;
    if (!/\.(csv|tsv|json)$/i.test(file.name)) {
      setError(`That is a ${file.type || 'file'}. The importer takes a CSV, a TSV or a JSON export.`);
      return;
    }
    setError('');
    setName(file.name);
    try {
      const text = await file.text();
      setRows(Math.max(0, text.split(/\r?\n/).filter((l) => l.trim()).length - 1));
    } catch {
      setRows(0);
    }
  }

  return (
    <>
      <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--s8) var(--s5)', borderStyle: 'dashed', borderWidth: '1.5px' }}>
        <Icon name="upload" size={28} style={{ color: 'var(--ink-3)' }} />
        <p className="card__title" style={{ marginTop: 'var(--s3)' }}>{name || 'Choose an export'}</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          {rows > 0
            ? `${rows} data rows found. Nothing has been read beyond counting the lines.`
            : 'CSV, TSV or JSON. Column names are matched, never assumed by position.'}
        </p>
        <input id="hist-file" type="file" accept=".csv,.tsv,.json,text/csv,application/json"
          className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
        <label htmlFor="hist-file" className="btn btn--ghost" style={{ marginTop: 'var(--s5)', cursor: 'pointer' }}>
          Choose a file
        </label>
      </div>
      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}

      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <button type="button" className="btn btn--primary grow" onClick={() => router.push('/app/import/history/review')}>
          Match the columns <Icon name="arrowRight" size={16} />
        </button>
      </div>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <p className="label">What happens next</p>
        <ol style={{ marginTop: 'var(--s3)' }}>
          {[
            ['Match the columns', 'You see what was matched to what, and change anything wrong.'],
            ['Dry run', 'Counts only. Nothing is written and you can walk away.'],
            ['Resolve', 'Anything that cannot be split reliably, one at a time, with the original text.'],
            ['Write', 'Once, in one transaction, with every row marked as imported.'],
          ].map(([t, s], i) => (
            <li key={t} className="brow" style={{ gridTemplateColumns: '24px 1fr' }}>
              <span className="mono dim small">{i + 1}</span>
              <span>
                <span className="brow__title" style={{ display: 'block' }}>{t}</span>
                <span className="brow__sub">{s}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
