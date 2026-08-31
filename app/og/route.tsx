import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

/** One OG image route, parameterised, so each of the marketing routes has its
 *  own card rather than seven pages sharing one. Drawn with the same ground
 *  and the same two result colours as the product. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') ?? 'Slippery').slice(0, 90);
  const sub = (searchParams.get('sub') ?? 'A bet tracker that captures at placement').slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0A0A0B',
          padding: '72px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180, right: -140,
            width: 620, height: 620,
            borderRadius: 620,
            background: 'radial-gradient(circle, rgba(217,212,199,0.20) 0%, rgba(10,10,11,0) 70%)',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#86EFAC' }} />
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#272A34' }} />
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#FCA5A5' }} />
          </div>
          <div style={{ color: '#F4F3F0', fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>SLIPPERY</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 940 }}>
          <div style={{ color: '#F4F3F0', fontSize: 74, fontWeight: 800, letterSpacing: -2.6, lineHeight: 1.04 }}>
            {title}
          </div>
          <div style={{ color: '#A9A8A3', fontSize: 32, lineHeight: 1.3 }}>{sub}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 26, color: '#74736F', fontSize: 22 }}>
          <div style={{ display: 'flex' }}>slippery-iota.vercel.app</div>
          <div style={{ display: 'flex', color: '#86EFAC' }}>+£213.75</div>
          <div style={{ display: 'flex', color: '#FCA5A5' }}>-£25.00</div>
          <div style={{ display: 'flex', marginLeft: 'auto' }}>18+ · BeGambleAware.org</div>
        </div>
      </div>
    ),
    SIZE,
  );
}
