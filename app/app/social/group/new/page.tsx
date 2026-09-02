import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { CreateGroup } from '@/components/app/CreateGroup';

export const metadata: Metadata = {
  title: 'Start a group',
  description: 'Name it, choose who can join, and share the code. Ranked in units, slip backed only.',
};

export default function NewGroup() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)', gap: 'var(--s2)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>
      <h1>Start a group</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        A table ranks everyone in units, so what people stake stays their own business.
        It takes about a minute.
      </p>
      <div className="column column--narrow" style={{ marginTop: 'var(--gap-block)', marginInline: 0 }}>
        <CreateGroup />
      </div>
    </>
  );
}
