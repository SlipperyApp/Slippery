import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { SETTINGS_GROUPS } from '@/lib/data/settings';
import { SettingsPanes } from '@/components/app/SettingsPanes';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Seven groups, each opening a detail pane. Everything here genuinely changes what is displayed.',
};

export default async function Settings() {
  const { data } = await getViewer();
  return (
    <>
      <div className="spread lgr__top">
        <h1>Settings</h1>
        <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">
          <Icon name="card" size={16} /> Plan and billing
        </Link>
      </div>
      <SettingsPanes groups={SETTINGS_GROUPS} account={data.account} />
    </>
  );
}
