import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { balanceSheet, CURRENCY_WORD } from '@/lib/data/balance-sheet';
import { nameList } from '@/lib/domain/balances';
import { OpenBalance } from '@/components/app/OpenBalance';
import { ShareBalance } from '@/components/app/ShareBalance';
import { sharePath } from '@/lib/data/share';
import { Icon } from '@/components/Icon';
import { money, pct, plural, units as fmtUnits } from '@/lib/format';

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

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Balances</h1>
        <Link href="/app/ledger" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Back to the ledger
        </Link>
      </div>

      {/*  WHICH BALANCES ARE IN WHICH CURRENCY, said in a sentence before any
           figure is shown. A sheet that prints two totals and leaves the
           reader to work out what each is made of from a column of symbols
           is a puzzle. This is the fact the rest of the page depends on, so
           it goes first. */}
      <div className="card" style={{ marginBottom: 'var(--gap-block)' }}>
        <p className="small muted">
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
      </div>

      {sheet.perCurrency.map((group) => {
        const lines = sheet.lines.filter((l) => l.currency === group.currency);
        return (
          <section
            key={group.currency}
            className="card"
            style={{ marginBottom: 'var(--gap-block)' }}
            aria-labelledby={`bs-${group.currency}`}
          >
            <header className="card__head">
              <h2 className="card__title" id={`bs-${group.currency}`}>
                In {CURRENCY_WORD[group.currency]}
              </h2>
              <p className="card__note">{nameList(group.balances)}</p>
            </header>

            <div className="scroller" tabIndex={0} role="region" aria-label={`Balances in ${CURRENCY_WORD[group.currency]}, scrollable`}>
              <table className="tbl bsheet">
                <caption className="sr-only">
                  Every balance kept in {CURRENCY_WORD[group.currency]}, with a total for the
                  currency. No figure here is a total across currencies.
                </caption>
                <thead>
                  <tr>
                    {/*  NET AND RETURN COME FIRST, before the count and the
                         turnover they are made of. The table scrolls on a
                         phone, and in column order Bets, Turnover, Net the
                         two figures somebody opened this page to compare
                         were the two off the right hand edge. */}
                    <th scope="col">Balance</th>
                    <th scope="col" className="num">Net</th>
                    <th scope="col" className="num">Return</th>
                    <th scope="col" className="num">Bets</th>
                    <th scope="col" className="num">Turnover</th>
                    <th scope="col" className="num">Units</th>
                    <th scope="col" className="num">In there</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.balance.id} className={l.balance.id === open.id ? 'bsheet__here' : undefined}>
                      <th scope="row" className="bsheet__name">
                        {l.balance.name}
                        {l.balance.id === open.id ? <span className="pill">Open</span> : null}
                        <span className="small dim bsheet__sub">
                          {money(l.balance.startMinor, l.currency)} to start
                          {l.depositedMinor > 0 ? `, ${money(l.depositedMinor, l.currency)} paid in` : ''}
                          {l.withdrawnMinor > 0 ? `, ${money(l.withdrawnMinor, l.currency)} taken out` : ''}
                        </span>
                      </th>
                      <td className={`num tnum ${l.netMinor > 0 ? 'pos' : l.netMinor < 0 ? 'neg' : ''}`}>
                        {money(l.netMinor, l.currency, { sign: true })}
                      </td>
                      <td className={`num tnum ${l.roi > 0 ? 'pos' : l.roi < 0 ? 'neg' : ''}`}>
                        {pct(l.roi, { sign: true })}
                      </td>
                      <td className="num tnum">{l.bets}</td>
                      <td className="num tnum">{money(l.turnoverMinor, l.currency)}</td>
                      <td className="num tnum">{fmtUnits(l.units, { sign: true })}</td>
                      <td className="num tnum">{money(l.balanceMinor, l.currency)}</td>
                      <td className="num">
                        {l.balance.id === open.id
                          ? <span className="small dim">Showing</span>
                          : <OpenBalance id={l.balance.id} name={l.balance.name} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="bsheet__name">
                      All {CURRENCY_WORD[group.currency]}
                      <span className="small dim bsheet__sub">{nameList(group.balances)}</span>
                    </th>
                    <td className={`num tnum ${group.netMinor > 0 ? 'pos' : group.netMinor < 0 ? 'neg' : ''}`}>
                      {money(group.netMinor, group.currency, { sign: true })}
                    </td>
                    <td className={`num tnum ${group.roi > 0 ? 'pos' : group.roi < 0 ? 'neg' : ''}`}>
                      {pct(group.roi, { sign: true })}
                    </td>
                    <td className="num tnum">{group.bets}</td>
                    <td className="num tnum">{money(group.turnoverMinor, group.currency)}</td>
                    <td className="num tnum">{fmtUnits(group.units, { sign: true })}</td>
                    <td className="num tnum">{money(group.balanceMinor, group.currency)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
              The return on this line is {money(group.netMinor, group.currency, { sign: true })} over{' '}
              {money(group.turnoverMinor, group.currency)} of turnover, not an average of the returns
              above it: averaging them would weight a balance with four bets in it the same as one
              with four hundred.
            </p>

            {/*  THE SHARE CONTROL SITS UNDER THE BALANCE IT SHARES, one per
                 row, rather than in a settings pane away from the figures it
                 gives away. Somebody deciding whether to hand a stranger a
                 link should be looking at what the link would show. */}
            <div className="sharelist">
              {lines.map((l) => (
                <ShareBalance
                  key={l.balance.id}
                  balanceId={l.balance.id}
                  name={l.balance.name}
                  path={l.balance.shareToken ? sharePath(l.balance.shareToken) : null}
                />
              ))}
            </div>
          </section>
        );
      })}

      {many ? (
        <p className="small dim">
          There is no figure on this page that adds {CURRENCY_WORD.GBP} to {CURRENCY_WORD.EUR}.
          One would need an exchange rate, the rate would be the one on the day you looked, and the
          number it produced would change overnight without a single bet being placed.
        </p>
      ) : null}
    </>
  );
}
