import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { getViewer } from '@/lib/data/session';
import { DemoNote } from '@/components/app/DemoNote';

export const metadata: Metadata = {
  // A string here REPLACES the root template for the whole subtree, so every
  // page under /app rendered a bare title with no product name in it. A
  // default plus its own template keeps both.
  title: { default: 'Your ledger', template: '%s · Slippery' },
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <AppShell chrome={viewer.chrome}>
      {viewer.demo ? <DemoNote handle={viewer.data.account.handle} /> : null}
      {viewer.readOnly ? (
        <div className="banner banner--warn" style={{ marginBottom: 'var(--gap-block)' }}>
          <span>
            <strong>Read only.</strong> Two payments failed, so new slips, imports and the bot are
            paused. The ledger and the export stay fully live, and nothing has been deleted.{' '}
            <a href="/app/billing/declined">Fix the card</a>.
          </span>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
