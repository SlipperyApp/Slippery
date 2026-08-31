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
        The bookmaker template is detected first and the slip is parsed second. Generic text
        recognition falls over on a permed bet; a per-book template does not.
      </p>
      <div style={{ marginTop: 'var(--s6)' }}><Analysing /></div>
    </div>
  );
}
