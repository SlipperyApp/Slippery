import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/** A share card for one dashboard module, drawn on the server.
 *
 *  NOT a screenshot. Screenshotting the DOM in the browser means either a
 *  third party rasteriser or the foreignObject trick, and both produce
 *  something that looks like a photograph of a website: the wrong fonts, the
 *  wrong scale, and whatever happened to be on screen. This draws a card
 *  designed to be an image, at 1080 square, which is the shape a phone's
 *  camera roll and every social app want.
 *
 *  Everything it renders comes from the query string as NUMBERS and a short
 *  enum. Nothing is echoed back as free text, so a share link cannot be made
 *  to draw somebody else's words on a Slippery-branded card. */

const SIZE = { width: 1080, height: 1080 };

const BG = '#0A0A0B';
const SURFACE = '#141416';
const LINE = '#26262A';
const INK = '#F4F3F0';
const INK2 = '#A9A8A3';
const POS = '#86EFAC';
const NEG = '#FCA5A5';

const PERIODS: Record<string, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  all: 'All time',
};

const SYMBOL: Record<string, string> = { GBP: '£', EUR: '€' };

/** Pence to a display string. The card never receives a formatted string,
 *  only an integer, so there is nothing to inject. */
function money(minor: number, cur: string, sign = false): string {
  const s = SYMBOL[cur] ?? '£';
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const body = `${s}${(abs / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (neg) return `−${body}`;
  return sign ? `+${body}` : body;
}

function int(v: string | null, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  const cur = q.get('cur') === 'EUR' ? 'EUR' : 'GBP';
  const period = PERIODS[q.get('period') ?? 'month'] ?? 'This month';
  const net = int(q.get('net'));
  const bets = Math.max(0, int(q.get('bets')));
  const units = int(q.get('units')) / 100;      // sent as hundredths
  const roi = int(q.get('roi')) / 10;           // sent as tenths of a per cent
  const turnover = Math.max(0, int(q.get('turn')));
  const handle = (q.get('h') ?? '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);

  const tone = net > 0 ? POS : net < 0 ? NEG : INK;

  /*  The mark, rebuilt from squares rather than loaded as a file.
   *
   *  Satori renders a subset of CSS and no SVG file, and the icon IS a five
   *  by five grid of rounded squares: the calendar, which is what the product
   *  is. Drawing it here means the card cannot fail on a missing asset. */
  const MARK = [
    'pnpn p', ' p pn', 'np pp', 'p nn ', ' pp p',
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: 84,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {MARK.map((row, y) => (
              <div key={y} style={{ display: 'flex', gap: 4 }}>
                {[...row].map((ch, x) => (
                  <div
                    key={x}
                    style={{
                      width: 9, height: 9, borderRadius: 2.5, display: 'flex',
                      background: ch === 'p' ? POS : ch === 'n' ? NEG : LINE,
                      opacity: ch === ' ' ? 1 : 0.85,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', color: INK, fontSize: 32, letterSpacing: -1, fontWeight: 700 }}>
            SLIPPERY
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: INK2, fontSize: 28, letterSpacing: 3 }}>
            {`NET · ${period.toUpperCase()}`}
          </div>

          <div
            style={{
              display: 'flex', color: tone, fontSize: 156, fontWeight: 800,
              letterSpacing: -7, marginTop: 10, lineHeight: 1.02,
            }}
          >
            {money(net, cur, true)}
          </div>

          <div style={{ display: 'flex', gap: 60, marginTop: 56, flexWrap: 'wrap' }}>
            {[
              ['Bets', String(bets)],
              ['Units', `${units >= 0 ? '+' : '\u2212'}${Math.abs(units).toFixed(2)}u`],
              ['Return', `${roi >= 0 ? '+' : '\u2212'}${Math.abs(roi).toFixed(1)}%`],
              ['Turnover', money(turnover, cur)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', color: INK2, fontSize: 22, letterSpacing: 2 }}>{k.toUpperCase()}</div>
                <div style={{ display: 'flex', color: INK, fontSize: 46, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', height: 1, background: LINE, width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', color: INK2, fontSize: 24 }}>
              {handle ? `@${handle}` : 'Captured at placement, not at settlement'}
            </div>
            <div style={{ display: 'flex', color: INK2, fontSize: 24 }}>18+ · begambleaware.org</div>
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
