import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data/session';
import { select, scopeFromParams, scopeLabel } from '@/lib/data/analytics';
import {
  COLUMNS, axisFromParam, axisLabel, columnFromParam, crosstab, defaultSort, sortCells,
} from '@/lib/data/analyser';
import { csvField } from '@/lib/server/export';
import { dayKey, moneyPlain } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The analyser's current view, as a file.
 *
 *  THE SAME VIEW, not a second one. The axes, the scope and the sort all
 *  arrive in the query string the page is already on, and this recomputes
 *  from the same select(), the same crosstab() and the same sortCells() the
 *  table used. An export that built its own rows would eventually hand
 *  somebody a file that disagrees with the screen they exported it from, and
 *  they would have no way to tell which one was wrong.
 *
 *  MONEY IS DECIMAL HERE AND NOWHERE ELSE, through moneyPlain, exactly as in
 *  lib/server/export.ts: a spreadsheet cannot use pence, and a stake column
 *  of 2500s summed and called twenty five pounds is the error this format
 *  exists to prevent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());

  const { data, now, demo, balance: bal } = await getViewer();
  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;

  const axis = axisFromParam(sp.dim) ?? 'sport';
  const second = axisFromParam(sp.dim2);
  const axis2 = second && second !== axis ? second : null;

  const rows = select(bets, scope, now, account.weekStart, account.timeZone);
  const tab = crosstab(rows, axis, axis2, {
    unitPence: account.unitPence,
    tz: account.timeZone,
    weekStart: account.weekStart,
  });

  const fallback = defaultSort(axis);
  const column = columnFromParam(sp.sort) ?? fallback.column;
  const dir = sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : fallback.dir;
  const cells = sortCells(tab, column, dir);

  /*  A cell in the file, by the same kind the table draws it by. `thin` is a
      column rather than a styling detail: a spreadsheet cannot grey a row,
      and a return over three bets pasted into a report with nothing marking
      it is the thing the marker exists to prevent. */
  const cellText = (kind: string, v: number | string): string => {
    switch (kind) {
      case 'money': return moneyPlain(Number(v));
      case 'pct': return Number(v).toFixed(2);
      case 'units': return Number(v).toFixed(2);
      case 'odds': return Number(v) > 0 ? Number(v).toFixed(4) : '';
      default: return String(v);
    }
  };

  const header = [
    axisLabel(axis).toLowerCase().replace(/ /g, '_'),
    ...(axis2 ? [axisLabel(axis2).toLowerCase().replace(/ /g, '_')] : []),
    ...COLUMNS.map((c) => c.id),
    'thin',
  ];

  const line = (label: string, label2: string | null, c: (typeof cells)[number], thin: boolean) => [
    label,
    ...(axis2 ? [label2 ?? ''] : []),
    ...COLUMNS.map((col) => cellText(col.kind, col.get(c))),
    thin ? 'true' : 'false',
  ].map(csvField).join(',');

  const body = [
    header.join(','),
    ...cells.map((c) => line(c.label, c.label2, c, c.thin)),
    /*  The total, folded from the whole selection rather than added up from
        the rows above it, and in the file for the same reason it is on the
        screen: a sheet whose rows do not sum to it is a sheet with a bug in
        it, and this is what somebody checks against. */
    line('All', axis2 ? 'All' : null, tab.total, false),
  ].join('\n');

  const stamp = dayKey(new Date(), account.timeZone);
  const slug = `${axis}${axis2 ? `-by-${axis2}` : ''}`;

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="slippery-analysis-${slug}-${stamp}.csv"`,
      /*  Which balance and which scope produced it, for anybody reading the
          response rather than the file: the figures are meaningless without
          both, and a CSV has nowhere to put them without adding a column
          that is the same on every row. */
      'x-slippery-view': `${bal.name} · ${scopeLabel(scope)}`,
    },
  });
}
