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
      <div style={{ marginTop: 'var(--s6)' }}><Analysing /></div>
    </div>
  );
}
