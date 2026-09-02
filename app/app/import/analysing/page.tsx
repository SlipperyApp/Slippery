import type { Metadata } from 'next';
import { Analysing } from '@/components/app/Analysing';

export const metadata: Metadata = {
  title: 'Reading the slip',
  description: 'Detecting the bookmaker template, then parsing the fields, then scoring each one.',
};

export default function AnalysingPage() {
  return (
    <div className="column">
      <h1>Reading the slip</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Every field is scored on its own, and any number the reader cannot also quote off the
        image is dropped rather than written. Nothing reaches your ledger until you have seen it.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><Analysing /></div>
    </div>
  );
}
