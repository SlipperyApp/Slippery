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

/* CENTRED, AND BIG ENOUGH TO READ AT PLAYBACK SIZE.
 *
 * These play in a column about 860px wide on a laptop and about 360px on a
 * phone, so a 1280px composition is shown at roughly two thirds and a 720px
 * one at half. Type sized for the canvas arrives on screen at half the size
 * it looked in the studio, which is why the first cut was unreadable. The
 * ramp below is set for the SHOWN size, not the rendered one.
 *
 * Everything is centred on both axes. The first cut hung its card off the
 * left in the wide shape while the title sat above it, so the frame read as
 * off balance at every moment except the sign-off. */
export const Stage: React.FC<{ step: string; title: string; children?: React.ReactNode }> =
({ step, title, children }) => {
  const vertical = useVertical();
  return (
    <AbsoluteFill style={{
      padding: vertical ? '80px 52px' : '48px 88px',
      display: 'flex', flexDirection: 'column', gap: vertical ? 34 : 30,
      justifyContent: 'center', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{ width: '100%' }}>
        <div style={{
          fontFamily: F.ui, fontSize: vertical ? 27 : 25, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.t3, wordSpacing: '-.08em', marginBottom: 16,
        }}>{step}</div>
        <div style={{
          fontFamily: F.serif, fontWeight: 700, color: C.t1,
          fontSize: vertical ? 62 : 62, lineHeight: 1.08, letterSpacing: '-.02em',
          maxWidth: vertical ? '100%' : '22ch', marginLeft: 'auto', marginRight: 'auto',
          textWrap: 'balance',
        }}>{title}</div>
      </div>
      {children ? (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>{children}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Card: React.FC<{ children: React.ReactNode; w?: number }> = ({ children, w = 900 }) => {
  const vertical = useVertical();
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 26,
      padding: vertical ? 34 : 34, width: vertical ? '100%' : w, maxWidth: '100%',
      textAlign: 'left',
    }}>{children}</div>
  );
};

/** Each row settles on a spring, 45ms after the one above it. */
/* `text` marks a value that is a phrase rather than a figure. Mono is for
   numbers that have to line up in a column; a sentence set in it reads as a
   terminal, which is what the first cut looked like. */
export const Row: React.FC<{
  k: string; v: string; tone?: string; delay?: number; first?: boolean; text?: boolean;
}> = ({ k, v, tone, delay = 0, first, text }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const s = spring({ frame: f - delay, fps, config: { damping: 18, stiffness: 120 } });
  return (
    /* SIDE BY SIDE IN THE WIDE CUT, STACKED IN THE TALL ONE.
       A 720px frame is not wide enough for a label and a phrase on one line:
       the value wins the space and the label ends up as "Cas…", which is
       worse than either. Stacked, both are whole. */
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: vertical ? 'flex-start' : 'baseline',
      gap: vertical ? 4 : 22,
      padding: vertical ? '14px 0' : '16px 0',
      borderTop: first ? 'none' : `1px solid ${C.line}`,
      opacity: s, transform: `translateY(${(1 - s) * 10}px)`,
    }}>
      <span style={{
        fontFamily: F.ui, fontSize: vertical ? 29 : 31, color: C.t3,
        flex: '0 1 auto', whiteSpace: 'nowrap',
        overflow: vertical ? 'visible' : 'hidden', textOverflow: 'ellipsis',
      }}>{k}</span>
      <span style={{
        fontFamily: text ? F.ui : F.mono,
        fontSize: vertical ? 35 : 32, color: tone ?? C.t1, fontWeight: 600,
        fontVariantNumeric: text ? 'normal' : 'tabular-nums',
        whiteSpace: 'nowrap', flex: '0 0 auto',
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
        fontFamily: F.serif, fontWeight: 700, fontSize: vertical ? 76 : 84, color: C.t1,
        letterSpacing: '-.03em', opacity: s, transform: `scale(${0.96 + s * 0.04})`,
      }}>Slippery</div>
      <div style={{
        fontFamily: F.ui, fontSize: vertical ? 30 : 31, color: C.t3, textAlign: 'center',
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
      fontFamily: F.ui, fontSize: 25, fontWeight: 600, color: col,
      border: `1px solid ${col}55`, background: `${col}1A`,
      borderRadius: 999, padding: '9px 20px', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
};

export const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Ribbons />
    {children}
  </AbsoluteFill>
);
