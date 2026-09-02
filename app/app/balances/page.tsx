import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { balanceSheet, CURRENCY_WORD } from '@/lib/data/balance-sheet';
import { nameList } from '@/lib/domain/balances';
import { BalanceTable } from '@/components/app/BalanceTable';
import { sharePath } from '@/lib/data/share';
import { Icon } from '@/components/Icon';
import { plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Balances',
  description: 'Every balance side by side, with a total for each currency and none across them.',
};

export default async function Balances() {
  /*  THE ONE PAGE THAT READS MORE THAN ONE BALANCE, and it reads the book
      through `book` rather than through `data`, which the viewer has already
      scoped to the balance that is open. */
  const { book, balances, balance: open } = await getViewer();
  const sheet = balanceSheet(balances, book.bets, book.movements);
  const many = sheet.perCurrency.length > 1;

  const groups = sheet.perCurrency.map((total) => ({
    total,
    word: CURRENCY_WORD[total.currency],
    names: nameList(total.balances),
    lines: sheet.lines.filter((l) => l.currency === total.currency),
  }));

  const sharePaths: Record<string, string | null> = {};
  for (const l of sheet.lines) {
    sharePaths[l.balance.id] = l.balance.shareToken ? sharePath(l.balance.shareToken) : null;
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s3)', flexWrap: 'wrap' }}>
        <h1>Balances</h1>
        <Link href="/app/ledger" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Back to the ledger
        </Link>
      </div>

      {/*  WHICH BALANCES ARE IN WHICH CURRENCY, said in a sentence before any
           figure is shown. A sheet that prints two totals and leaves the
           reader to work out what each is made of from a column of symbols
           is a puzzle. This is the fact the rest of the page depends on, so
           it goes first.

           NOT IN A CARD OF ITS OWN. Every small paragraph in this product is
           held to 54ch, so a page-wide card around one is 54 characters of
           text and, at 1920, thirteen hundred pixels of framed nothing. A
           page's opening sentence is a lead, and a lead does not need a
           border round it to be read first. */}
      <p className="small muted" style={{ marginBottom: 'var(--gap-block)' }}>
        {plural(sheet.lines.length, 'balance')} on this account
        {sheet.perCurrency.map((c, i) => (
          <span key={c.currency}>
            {i === 0 ? ': ' : '; '}
            <strong>{nameList(c.balances)}</strong>{' '}
            {c.balances.length === 1 ? 'is' : 'are'} in {CURRENCY_WORD[c.currency]}
          </span>
        ))}
        .{' '}
        {many
          ? 'The totals below are per currency. Nothing on this page adds two of them together, because the sum would not be an amount of anything.'
          : 'Each one keeps its own starting figure, its own money in and out and its own bets, so no figure here is an average over two of them.'}
      </p>

      <BalanceTable groups={groups} openId={open.id} sharePaths={sharePaths} many={many} />
    </>
  );
}
