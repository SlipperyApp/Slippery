import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, facets, filterByOutcome, scopeFromParams, scopeLabel,
} from '@/lib/data/analytics';
import { ScopeBar } from '@/components/app/ScopeBar';
import { LedgerRows } from '@/components/app/LedgerRows';
import { Figure } from '@/components/app/Module';
import { Icon } from '@/components/Icon';
import { money, pct, count, TZ_LABEL } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Ledger',
  description: 'Every bet, with facets whose counts agree with the rows they promise.',
};

export default async function Ledger({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { data, now, demo } = await getViewer();
  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;

  // ONE query. Everything below counts what this returns, which is why the
  // facet total equals the row total.
  const rows = select(bets, scope, now, account.weekStart);
  const outcome = typeof sp.outcome === 'string' ? sp.outcome : null;
  const search = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';

  const facetSet = facets(rows);
  let shown = filterByOutcome(rows, outcome);
  if (search) {
    shown = shown.filter((b) =>
      `${b.selection} ${b.eventName} ${b.marketRaw} ${b.competition ?? ''} ${b.course ?? ''}`
        .toLowerCase().includes(search));
  }
  shown = [...shown].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());

  const s = summarise(shown);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Ledger</h1>
        <div className="row" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/history" className="btn btn--quiet btn--sm">
            <Icon name="clipboard" size={16} /> Change history
          </Link>
          <Link href="/app/import" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Add a bet
          </Link>
        </div>
      </div>

      <ScopeBar scope={scope} />

      <div className="card" style={{ marginBottom: 'var(--s4)' }}>
        <div className="row row--wrap" style={{ gap: 'var(--s7)' }}>
          <Figure value={money(s.stakedPence, account.currency)} label="Staked" size="sm" />
          <Figure value={money(s.returnedPence, account.currency)} label="Returned" size="sm" />
          <Figure
            value={money(s.netPence, account.currency, { sign: true })}
            label="Net"
            size="sm"
            tone={s.netPence > 0 ? 'pos' : s.netPence < 0 ? 'neg' : ''}
          />
          <Figure value={pct(s.roi, { sign: true })} label="Return" size="sm" tone={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''} />
          <Figure value={count(s.count)} label="Bets" size="sm" />
        </div>
        {s.voidedStakePence > 0 ? (
          <p className="small dim card__foot">
            Turnover and ROI exclude {money(s.voidedStakePence, account.currency)} of voided stakes.
          </p>
        ) : (
          <p className="small dim card__foot">{scopeLabel(scope)}. {TZ_LABEL}.</p>
        )}
      </div>

      <LedgerRows
        bets={shown}
        facets={facetSet.list}
        facetTotal={facetSet.total}
        rowTotal={rows.length}
        activeOutcome={outcome}
        search={search}
        currency={account.currency}
        oddsFormat={account.oddsFormat}
        showProfitIn={account.showProfitIn}
      />
    </>
  );
}
