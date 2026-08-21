import React from 'react';
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion';
import { C, F, FPS } from './theme';

/* THE SHARED KIT.
 *
 * Six films share this, and the point is that they cannot drift: the same
 * beat length, the same crossfade, the same ribbons, the same card, the same
 * type ramp. A landing page whose six clips each move slightly differently
 * reads as six clips somebody found, not as one product.
 *
 * Every component reads useVideoConfig and lays out for the shape it is in,
 * so the phone cut is a different composition rather than a crop with the
 * sides taken off the words.
 */

export const BEAT = 6 * FPS;
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** True when the frame is taller than it is wide: the phone cut. */
export const useVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

export const Crossfade: React.FC<{ children: React.ReactNode; beat?: number }> =
({ children, beat = BEAT }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 14, beat - 8, beat + 6], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut,
  });
  const lift = interpolate(f, [0, 20], [16, 0], { extrapolateRight: 'clamp', easing: easeOut });
  return <AbsoluteFill style={{ opacity, transform: `translateY(${lift}px)` }}>{children}</AbsoluteFill>;
};

export const Beat: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => (
  <Sequence from={from} durationInFrames={BEAT + 12}>
    <Crossfade>{children}</Crossfade>
  </Sequence>
);

/* The ribbons the landing page draws, drifting. Transform only. */
export const Ribbons: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = (rate: number, amp: number) => Math.sin((f / FPS) * rate) * amp;
  return (
    <AbsoluteFill style={{ opacity: 0.5 }}>
      <svg width={width} height={height} viewBox="0 0 1440 300" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, height: height * 0.42 }}>
        <defs>
          <linearGradient id="kitg" x1="0" x2="1">
            <stop offset="0" stopColor={C.lg1} stopOpacity="0" />
            <stop offset=".32" stopColor={C.lg1} />
            <stop offset="1" stopColor={C.lg2} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-200 140C180 80 460 210 740 120S1240 50 1640 130" stroke="url(#kitg)"
          strokeWidth="15" fill="none" strokeLinecap="round"
          transform={`translate(0 ${drift(0.6, 12)})`} />
        <path d="M-200 195C250 255 520 100 820 180S1280 240 1640 155" stroke="url(#kitg)"
          strokeWidth="11" fill="none" strokeLinecap="round" opacity=".8"
          transform={`translate(0 ${drift(0.42, 18)})`} />
        <path d="M-200 95C300 165 560 45 900 110S1300 165 1640 90" stroke="url(#kitg)"
          strokeWidth="20" fill="none" strokeLinecap="round" opacity=".55"
          transform={`translate(0 ${drift(0.31, 9)})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Stage: React.FC<{ step: string; title: string; children?: React.ReactNode }> =
({ step, title, children }) => {
  const vertical = useVertical();
  return (
    <AbsoluteFill style={{
      padding: vertical ? '150px 70px' : '96px 140px',
      display: 'flex', flexDirection: 'column', gap: vertical ? 54 : 40,
      justifyContent: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: F.ui, fontSize: vertical ? 26 : 22, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.t3, wordSpacing: '-.08em', marginBottom: 18,
        }}>{step}</div>
        <div style={{
          fontFamily: F.serif, fontWeight: 700, color: C.t1,
          fontSize: vertical ? 76 : 80, lineHeight: 1.06, letterSpacing: '-.02em',
          maxWidth: vertical ? '100%' : '13ch',
        }}>{title}</div>
      </div>
      {children ? (
        <div style={{ display: 'flex', justifyContent: vertical ? 'center' : 'flex-start' }}>{children}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Card: React.FC<{ children: React.ReactNode; w?: number }> = ({ children, w = 620 }) => {
  const vertical = useVertical();
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 22,
      padding: vertical ? 40 : 34, width: vertical ? '100%' : w, maxWidth: '100%',
    }}>{children}</div>
  );
};

/** Each row settles on a spring, 45ms after the one above it. */
export const Row: React.FC<{ k: string; v: string; tone?: string; delay?: number; first?: boolean }> =
({ k, v, tone, delay = 0, first }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24,
      padding: '15px 0', borderTop: first ? 'none' : `1px solid ${C.line}`,
      opacity: s, transform: `translateY(${(1 - s) * 10}px)`,
    }}>
      <span style={{ fontFamily: F.ui, fontSize: 25, color: C.t2 }}>{k}</span>
      <span style={{
        fontFamily: F.mono, fontSize: 27, color: tone ?? C.t1,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{v}</span>
    </div>
  );
};

/** The closing frame every film ends on, so six clips read as one product. */
export const SignOff: React.FC<{ line: string }> = ({ line }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const s = spring({ frame: f, fps, config: { damping: 20, stiffness: 90 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <div style={{
        fontFamily: F.serif, fontWeight: 700, fontSize: vertical ? 96 : 104, color: C.t1,
        letterSpacing: '-.03em', opacity: s, transform: `scale(${0.96 + s * 0.04})`,
      }}>Slippery</div>
      <div style={{
        fontFamily: F.ui, fontSize: vertical ? 30 : 28, color: C.t3, textAlign: 'center',
        maxWidth: vertical ? '80%' : '30ch',
        opacity: interpolate(f, [8, 26], [0, 1], { extrapolateRight: 'clamp' }),
      }}>{line}</div>
    </AbsoluteFill>
  );
};

export const Pill: React.FC<{ text: string; tone?: 'pos' | 'neg' | 'a' | 'p' }> = ({ text, tone = 'p' }) => {
  const col = tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : tone === 'a' ? C.a : C.s;
  return (
    <span style={{
      fontFamily: F.ui, fontSize: 21, fontWeight: 600, color: col,
      border: `1px solid ${col}55`, background: `${col}1A`,
      borderRadius: 999, padding: '7px 16px', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
};

export const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Ribbons />
    {children}
  </AbsoluteFill>
);
