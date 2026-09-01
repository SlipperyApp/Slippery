import { MARK_CLIP, MARK_PATH, MARK_TILE, MARK_INK, MARK_ACCENT } from '@/lib/brand';
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
const LINE = '#26262A';
const INK = '#F4F3F0';
const INK2 = '#A9A8A3';
const POS = '#86EFAC';
const NEG = '#FCA5A5';

/*  A plain object literal inherits from Object.prototype, so PERIODS.toString
 *  is a FUNCTION, not undefined, and `?? 'This month'` never fires for it.
 *  /api/share?period=toString reached period.toUpperCase() on a function and
 *  returned 500 on the live site. Every one of these maps is indexed by a
 *  query string, so all of them are built without a prototype and every read
 *  goes through own(). */
function table(entries: Record<string, string>): Record<string, string> {
  return Object.assign(Object.create(null) as Record<string, string>, entries);
}

/** Own properties only, and always a string. */
function own(map: Record<string, string>, key: string | null, fallback: string): string {
  if (key === null) return fallback;
  const v = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  return typeof v === 'string' ? v : fallback;
}

const PERIODS = table({
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  all: 'All time',
});

const SYMBOL = table({ GBP: '£', EUR: '€' });

/** Pence to a display string. The card never receives a formatted string,
 *  only an integer, so there is nothing to inject. */
function money(minor: number, cur: string, sign = false): string {
  const s = own(SYMBOL, cur, '£');
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
  const period = own(PERIODS, q.get('period') ?? 'month', 'This month');
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
          {/*  The mark, drawn from lib/brand.ts, which carries the paths in
               public/app-icon.svg. Satori loads no external file, so it is
               inline; a test asserts these are still the icon's own paths. */}
          <svg width={56} height={56} viewBox="0 0 1024 1024">
            <defs>
              <clipPath id="mk-cut"><path d={MARK_CLIP} /></clipPath>
            </defs>
            <rect width="1024" height="1024" rx="230" fill={MARK_TILE} />
            <path d={MARK_PATH} fill={MARK_INK} />
            <g clipPath="url(#mk-cut)"><path d={MARK_PATH} fill={MARK_ACCENT} /></g>
          </svg>
          <div style={{ display: 'flex', color: INK, fontSize: 32, letterSpacing: -1, fontWeight: 700 }}>
            SLIPPERY
          </div>
        </div>

        {/*  A rule in the result's own colour, down the left of the figure it
             belongs to. The card is a 1080 square holding three short blocks,
             so it has more air than content; the rule gives the middle block
             an edge to sit against instead of floating in the middle of a
             field, and it carries the one colour that means something. */}
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            borderLeft: `7px solid ${tone}`, paddingLeft: 40, marginLeft: -47,
          }}
        >
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
