import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data/session';
import { turnoverPence, effectiveOdds, riskPence } from '@/lib/domain/fold';
import { bookmakerName } from '@/lib/data/reference';
import { londonDay, money } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Export always works. In read only, and after cancelling, because a betting
 *  record belongs to the person who kept it. */
export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') ?? 'csv';
  const { data } = await getViewer();
  const stamp = new Date().toISOString().slice(0, 10);

  const rows = data.bets.map((b) => ({
    id: b.id,
    eventAt: b.eventAt,
    day: londonDay(b.eventAt),
    placedAt: b.placedAt,
    shape: b.shape,
    side: b.side,
    selection: b.selection,
    eventName: b.eventName,
    market: b.marketRaw,
    legs: b.legs.map((l) => `${l.selection} @ ${l.legOdds}`).join(' | '),
    bookmaker: bookmakerName(b.bookmakerId),
    tipster: b.tipsterId ?? '',
    sport: b.sportId,
    currency: b.currency,
    stakePence: riskPence(b),
    odds: effectiveOdds(b),
    freeBet: b.isFreeBet,
    boosted: b.isBoosted,
    slipBacked: b.slipBacked,
    source: b.source,
    unitPenceAtPlacement: b.unitPenceAtPlacement,
    status: b.state.status,
    outcome: b.state.outcome ?? '',
    returnedPence: b.state.returnedPence,
    profitPence: b.state.realisedPlPence,
    voidedStakePence: b.state.voidedStakePence,
    turnoverPence: turnoverPence(b, b.state),
    units: b.state.units,
    events: b.events.map((e) => `${e.type}${e.fractionEighths ? `(${e.fractionEighths}/8)` : ''}`).join(' | '),
  }));

  if (format === 'json') {
    return new NextResponse(JSON.stringify({ account: data.account.handle, exportedAt: new Date().toISOString(), bets: rows }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="slippery-${stamp}.json"`,
      },
    });
  }

  if (format === 'pdf') {
    // A text ledger rather than a fake PDF. Producing a real PDF needs a
    // renderer this deployment does not carry, and a file with the wrong
    // bytes inside is worse than an honest one with the right ones.
    const lines = [
      'SLIPPERY LEDGER',
      `Account @${data.account.handle}`,
      `Exported ${new Date().toISOString()}`,
      `${rows.length} bets`,
      '',
      ...rows.map((r) =>
        `${r.day}  ${String(r.selection).padEnd(28).slice(0, 28)}  ${String(r.bookmaker).padEnd(16).slice(0, 16)}  ${money(r.stakePence, data.account.currency).padStart(11)}  ${String(r.odds).padStart(7)}  ${String(r.outcome || r.status).padEnd(12)}  ${money(r.profitPence, data.account.currency, { sign: true }).padStart(12)}`),
    ];
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="slippery-${stamp}.txt"`,
      },
    });
  }

  const headers = Object.keys(rows[0] ?? { id: '' });
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(',')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="slippery-${stamp}.csv"`,
    },
  });
}
