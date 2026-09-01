import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data/session';
import { turnoverPence, effectiveOdds, riskPence } from '@/lib/domain/fold';
import { bookmakerName } from '@/lib/data/reference';
import { londonDay, money } from '@/lib/format';
import { textPdf } from '@/lib/server/pdf';

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
    /*  A real PDF, from lib/server/pdf.ts. This used to return a .txt with a
     *  comment explaining that a PDF needed a renderer, which is an honest
     *  comment inside a broken promise: /pricing sells "CSV, JSON and PDF
     *  export, always" and Settings offers a PDF button. */
    const cur = data.account.currency;
    const net = rows.reduce((a, r) => a + r.profitPence, 0);
    /*  Truncate one short of the column so a long selection cannot butt up
     *  against the bookmaker beside it: "Over 2.5 goals / Real Sociedadbet365"
     *  is two facts read as one word. */
    const col = (v: string, n: number) => (v.length > n - 1 ? `${v.slice(0, n - 2)}…` : v).padEnd(n);
    const lines = [
      'SLIPPERY LEDGER',
      `Account @${data.account.handle}`,
      `Exported ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
      `${rows.length} bets, ${money(net, cur, { sign: true })} net`,
      '',
      `${col('DAY', 12)}${col('SELECTION', 30)}${col('BOOKMAKER', 18)}${'STAKE'.padStart(11)}`
      + `${'PRICE'.padStart(9)}  ${col('RESULT', 14)}${'NET'.padStart(12)}`,
      ''.padEnd(106, '-'),
      ...rows.map((r) =>
        `${col(r.day, 12)}${col(String(r.selection), 30)}${col(String(r.bookmaker), 18)}`
        + `${money(r.stakePence, cur).padStart(11)}${r.odds.toFixed(2).padStart(9)}  `
        + `${col(String(r.outcome || r.status), 14)}`
        + `${money(r.profitPence, cur, { sign: true }).padStart(12)}`),
      '',
      'Slippery never accepts bets, holds money, pays winnings or gives tips.',
      '18+ · BeGambleAware.org · National Gambling Helpline 0808 8020 133',
    ];
    const pdf = textPdf({
      title: `Slippery ledger, @${data.account.handle}`,
      lines,
      footer: (page, of) => `Slippery · @${data.account.handle} · ${stamp} · page ${page} of ${of}`,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="slippery-${stamp}.pdf"`,
        'content-length': String(pdf.length),
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
