import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { select, scopeFromParams, scopeLabel } from '@/lib/data/analytics';
import { axisFromParam, axisLabel, crosstab } from '@/lib/data/analyser';
import { ScopeBar } from '@/components/app/ScopeBar';
import { Analyser } from '@/components/app/Analyser';
import { Icon } from '@/components/Icon';
import { plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Analyser',
  description: 'Any two dimensions of the record crossed, with every row folded from one selection.',
};

export default async function AnalyserPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { data, now, demo, balance: bal } = await getViewer();
  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;

  /*  Validated against the list, never looked up in an object. `?dim=
      toString` is a key every plain object literal inherits, which is how a
      route that read a query parameter through one returned 500 on the live
      site for weeks. */
  const axis = axisFromParam(sp.dim) ?? 'sport';
  const second = axisFromParam(sp.dim2);
  const axis2 = second && second !== axis ? second : null;

  // ONE query. Every cell below counts what this returns.
  const rows = select(bets, scope, now, account.weekStart, account.timeZone);
  const tab = crosstab(rows, axis, axis2, {
    unitPence: account.unitPence,
    tz: account.timeZone,
    weekStart: account.weekStart,
  });
  const thinCount = tab.rows.filter((c) => c.thin && c.bets > 0).length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Analyser</h1>
        <Link href="/app" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Back to the dashboard
        </Link>
      </div>

      <ScopeBar scope={scope} />

      {/*  NOT IN A CARD. Every small paragraph in this product is held to 54
           characters, so a page wide card around one sentence is a border
           round a third of a line and, at 1920, thirteen hundred pixels of
           framed nothing between the scope bar and the table. What this line
           says is which selection the table below is drawn from, which is a
           caption on the table rather than a module of its own. */}
      <p className="small muted" style={{ margin: 'var(--s4) 0 var(--gap-block)' }}>
        {axisLabel(axis)}
        {axis2 ? <> crossed with <strong>{axisLabel(axis2).toLowerCase()}</strong></> : null}
        , over {plural(tab.total.bets, 'bet')} in {bal.name} · {scopeLabel(scope)}. Press any
        column to sort by it.
      </p>

      {/*  Crossed, this table is 4,127 pixels at 1440 by 900 against the 824
           the window leaves, and the axis it is crossed on is stated above
           it. The table scrolls and the statement stays. */}
      <div className="card fitcol fitcol--scroll">
        {tab.total.bets === 0 ? (
          <p className="small dim">Nothing in this scope yet. Widen the period above.</p>
        ) : (
          <Analyser tab={tab} currency={account.currency} thinCount={thinCount} />
        )}
      </div>
    </>
  );
}
