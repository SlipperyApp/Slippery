'use client';

import { useEffect } from 'react';
import { ServerErrorPane } from '@/components/marketing/ErrorPane';

export default function ErrorBoundary({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is the only thing that links this to a server log line, and
    // it carries nothing about the request.
    console.error('Render failed', error.digest ?? '');
  }, [error]);

  return (
    <div className="page">
      <main id="main"><div className="wrap"><ServerErrorPane reset={reset} /></div></main>
    </div>
  );
}
