'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { isHandle } from '@/lib/server/codes';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { keepAnswers, stepHref } from '@/lib/signup-draft';
import { useDraft } from '@/components/auth/useDraft';

export function NameForm() {
  const router = useRouter();
  const draft = useDraft();
  /*  Every field starts from the URL, so stepping back into this screen shows
      what was typed rather than an empty form. */
  const [name, setName] = useState(draft.displayName);
  const [handle, setHandle] = useState(draft.handle);
  const [referral, setReferral] = useState(draft.referral);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const suggested = handle || name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16);
  const handleOk = !suggested || isHandle(suggested);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError('A name of at least two characters, so a group can tell you apart.'); return; }
    if (!handleOk) { setError('A handle is 3 to 20 characters, lowercase letters, numbers and underscores.'); return; }
    setError(''); setBusy(true);
    await fetch('/api/auth/profile', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: name.trim(), handle: suggested, referral: referral.trim() }),
    }).catch(() => null);
    const answered = { ...draft, displayName: name.trim(), handle: suggested, referral: referral.trim() };
    keepAnswers('/signup/name', answered);
    router.push(stepHref('/signup/unit', answered));
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="nm">Display name</label>
        <input id="nm" name="name" className="input" autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Rowan Ellis" required />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="hn">Handle</label>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="mono dim" aria-hidden="true">@</span>
          <input id="hn" name="handle" className="input mono" autoComplete="username"
            value={suggested} onChange={(e) => setHandle(e.target.value.toLowerCase())}
            placeholder="rowanellis" aria-describedby="hn-hint" />
        </div>
        <span className="field__hint" id="hn-hint">
          3 to 20 characters. Lowercase letters, numbers and underscores.
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="rf">Referral code, if you have one</label>
        <input id="rf" name="referral" className="input mono" autoComplete="off"
          value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())}
          placeholder="Optional" aria-describedby="rf-hint" />
        <span className="field__hint" id="rf-hint">
          A valid code extends the trial. Without one it is {TRIAL_DAYS} days or {TRIAL_SLIPS} slips.
        </span>
      </div>

      {error ? <p className="field__err" role="alert">{error}</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        Continue <Icon name="arrowRight" size={16} />
      </button>
    </form>
  );
}
