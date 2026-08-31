'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // A browser that refuses the clipboard still shows the code, which is
      // the thing that matters.
      setCopied(false);
    }
  }

  return (
    <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
      <span className="fig fig--m mono" style={{ letterSpacing: '0.06em' }}>{code}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={copy} aria-live="polite">
        <Icon name={copied ? 'check' : 'clipboard'} size={15} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
