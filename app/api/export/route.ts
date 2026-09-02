import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/data/session';
import { effectiveOdds, riskPence } from '@/lib/domain/fold';
import { bookmakerName } from '@/lib/data/reference';
import { dayKey, money } from '@/lib/format';
import { textPdf } from '@/lib/server/pdf';
import { EXPORT_COLUMNS, EXPORT_SCHEMA_VERSION, exportRows, toCsv } from '@/lib/server/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Export always works. In read only, and after cancelling, because a betting
 *  record belongs to the person who kept it. */
export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') ?? 'csv';
  /*  ONE BALANCE PER FILE, because the viewer hands out one balance's books.
      That is the right unit: two balances have their own currencies and
      their own starting figures, and a spreadsheet with both in it would
      have a stake column that cannot be summed. The name is in the filename
      and in the header of every format, so nobody has to remember which
      export is which. */
  const { data, balance: bal } = await getViewer();
  const tz = data.account.timeZone;
  // The account's own day, so a file exported at 00:20 in Dublin is not
  // stamped with yesterday.
  const stamp = dayKey(new Date(), tz);
  /*  Lowercased and hyphenated so it is a filename rather than a sentence.
      A balance called "Matched betting float" would otherwise produce a name
      that half the shells on earth need quoting. */
  const slug = bal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'balance';

  /*  One row builder for both machine formats, and its column order is
      frozen in lib/server/export.ts. See the note there: people build
      spreadsheets on this, and the header used to come from whatever order
      an object literal happened to be written in. */
  const rows = exportRows(data.bets, tz);

  if (format === 'json') {
    return new NextResponse(JSON.stringify({
      schema_version: EXPORT_SCHEMA_VERSION,
      columns: EXPORT_COLUMNS,
      account: data.account.handle,
      balance: bal.name,
      currency: bal.currency,
      exported_at: new Date().toISOString(),
      bets: rows,
    }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="slippery-${slug}-${stamp}.json"`,
      },
    });
  }

  if (format === 'pdf') {
    /*  A real PDF, from lib/server/pdf.ts. This used to return a .txt with a
     *  comment explaining that a PDF needed a renderer, which is an honest
     *  comment inside a broken promise: /pricing sells "CSV, JSON and PDF
     *  export, always" and Settings offers a PDF button. */
    const cur = data.account.currency;
    /*  The PDF is read by a person, so it keeps integer minor units all the
        way to money(), symbol and all. It cannot read the CSV rows: those
        are already decimal strings for a spreadsheet, and re-parsing them
        into a total would be a float sum of money. */
    const net = data.bets.reduce((a, b) => a + b.state.realisedPlPence, 0);
    /*  Truncate one short of the column so a long selection cannot butt up
     *  against the bookmaker beside it: "Over 2.5 goals / Real Sociedadbet365"
     *  is two facts read as one word. */
    const col = (v: string, n: number) => (v.length > n - 1 ? `${v.slice(0, n - 2)}…` : v).padEnd(n);
    const lines = [
      'SLIPPERY LEDGER',
      `Account @${data.account.handle}`,
      `Balance ${bal.name}, in ${bal.currency}`,
      `Exported ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
      `${data.bets.length} bets, ${money(net, cur, { sign: true })} net`,
      '',
      `${col('DAY', 12)}${col('SELECTION', 30)}${col('BOOKMAKER', 18)}${'STAKE'.padStart(11)}`
      + `${'PRICE'.padStart(9)}  ${col('RESULT', 14)}${'NET'.padStart(12)}`,
      ''.padEnd(106, '-'),
      ...data.bets.map((b) =>
        `${col(dayKey(b.eventAt, tz), 12)}${col(b.selection, 30)}${col(bookmakerName(b.bookmakerId), 18)}`
        + `${money(riskPence(b), cur).padStart(11)}${effectiveOdds(b).toFixed(2).padStart(9)}  `
        + `${col(b.state.outcome ?? b.state.status, 14)}`
        + `${money(b.state.realisedPlPence, cur, { sign: true }).padStart(12)}`),
      '',
      'Slippery never accepts bets, holds money, pays winnings or gives tips.',
      '18+ · BeGambleAware.org · National Gambling Helpline 0808 8020 133',
    ];
    const pdf = textPdf({
      title: `Slippery ledger, @${data.account.handle}`,
      lines,
      footer: (page, of) => `Slippery · @${data.account.handle} · ${bal.name} · ${stamp} · page ${page} of ${of}`,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="slippery-${slug}-${stamp}.pdf"`,
        'content-length': String(pdf.length),
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="slippery-${slug}-${stamp}.csv"`,
    },
  });
}
