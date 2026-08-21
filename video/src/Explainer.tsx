import React from 'react';
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion';
import { C, F, FPS } from './theme';

/* THE LOOP, IN FOUR BEATS.
 *
 * Send the slip, it reads it, you confirm, it settles. That is the product,
 * and it is the only thing this video is for. No feature tour, no figures
 * that will be out of date next month, no claim about winning.
 *
 * Every beat is six seconds and every transition is a crossfade, because a
 * video that cuts hard needs a soundtrack to carry the cut and there is no
 * audio track here on purpose.
 */

const BEAT = 6 * FPS;

/* Shared easing with the site, so the video and the interface move the same
   way. Values are the same curve the stylesheet calls --ease-out. */
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

/** Fade a child in and out inside its own beat. */
const Beat: React.FC<{ from: number; children: React.ReactNode }> = ({ from, children }) => (
  <Sequence from={from} durationInFrames={BEAT + 12}>
    <Crossfade>{children}</Crossfade>
  </Sequence>
);

const Crossfade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 14, BEAT - 8, BEAT + 6], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut,
  });
  const lift = interpolate(f, [0, 20], [16, 0], { extrapolateRight: 'clamp', easing: easeOut });
  return <AbsoluteFill style={{ opacity, transform: `translateY(${lift}px)` }}>{children}</AbsoluteFill>;
};

/* The ribbons, the same shapes the landing page draws, drifting slowly. */
const Ribbons: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = (rate: number, amp: number) => Math.sin((f / FPS) * rate) * amp;
  return (
    <AbsoluteFill style={{ opacity: 0.5 }}>
      <svg width={width} height={height} viewBox="0 0 1440 300" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, height: height * 0.42 }}>
        <defs>
          <linearGradient id="ga" x1="0" x2="1">
            <stop offset="0" stopColor={C.lg1} stopOpacity="0" />
            <stop offset=".32" stopColor={C.lg1} />
            <stop offset="1" stopColor={C.lg2} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g>
          <path d="M-200 140C180 80 460 210 740 120S1240 50 1640 130" stroke="url(#ga)"
            strokeWidth="15" fill="none" strokeLinecap="round"
            transform={`translate(0 ${drift(0.6, 12)})`} />
          <path d="M-200 195C250 255 520 100 820 180S1280 240 1640 155" stroke="url(#ga)"
            strokeWidth="11" fill="none" strokeLinecap="round" opacity=".8"
            transform={`translate(0 ${drift(0.42, 18)})`} />
          <path d="M-200 95C300 165 560 45 900 110S1300 165 1640 90" stroke="url(#ga)"
            strokeWidth="20" fill="none" strokeLinecap="round" opacity=".55"
            transform={`translate(0 ${drift(0.31, 9)})`} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ step: string; title: string; children: React.ReactNode }> = ({ step, title, children }) => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <AbsoluteFill style={{
      padding: vertical ? '140px 70px' : '100px 140px',
      display: 'flex', flexDirection: 'column', gap: vertical ? 56 : 40,
      justifyContent: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: F.ui, fontSize: vertical ? 26 : 22, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.t3, wordSpacing: '-.08em', marginBottom: 18,
        }}>{step}</div>
        <div style={{
          fontFamily: F.serif, fontWeight: 700, color: C.t1,
          fontSize: vertical ? 78 : 82, lineHeight: 1.06, letterSpacing: '-.02em',
          maxWidth: vertical ? '100%' : '13ch',
        }}>{title}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: vertical ? 'center' : 'flex-start' }}>{children}</div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ children: React.ReactNode; w?: number }> = ({ children, w = 620 }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 22,
    padding: 34, width: w, maxWidth: '100%',
  }}>{children}</div>
);

const Row: React.FC<{ k: string; v: string; tone?: string; delay?: number }> = ({ k, v, tone, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  /* A spring rather than a duration, so each row settles rather than
     stopping. 45ms apart, the same stagger the site uses. */
  const s = spring({ frame: f - delay, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '15px 0', borderTop: `1px solid ${C.line}`,
      opacity: s, transform: `translateY(${(1 - s) * 10}px)`,
    }}>
      <span style={{ fontFamily: F.ui, fontSize: 25, color: C.t2 }}>{k}</span>
      <span style={{ fontFamily: F.mono, fontSize: 27, color: tone ?? C.t1, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
};

/* ---- beat one: send it ------------------------------------------------- */
const Send: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fly = spring({ frame: f - 22, fps, config: { damping: 20, stiffness: 90 } });
  return (
    <Stage step="One" title="Forward the slip.">
      <Card w={560}>
        <div style={{
          fontFamily: F.mono, fontSize: 22, color: C.t3, marginBottom: 20,
          letterSpacing: '.04em',
        }}>TELEGRAM</div>
        <div style={{
          transform: `translateY(${(1 - fly) * 26}px)`, opacity: fly,
          background: C.elev, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22,
        }}>
          <div style={{ fontFamily: F.ui, fontSize: 26, color: C.t1, marginBottom: 8 }}>
            Juventus v Cremonese
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 23, color: C.t2 }}>
            4 legs · 1.80 · £100.00
          </div>
        </div>
        <div style={{
          marginTop: 20, fontFamily: F.ui, fontSize: 22, color: C.t3,
        }}>The moment you place it, not when it wins.</div>
      </Card>
    </Stage>
  );
};

/* ---- beat two: it reads it --------------------------------------------- */
const Read: React.FC = () => (
  <Stage step="Two" title="It reads it.">
    <Card>
      <div style={{
        fontFamily: F.mono, fontSize: 22, color: C.s, marginBottom: 6, letterSpacing: '.04em',
      }}>READ · 4 LEGS · BET365</div>
      <Row k="Stake" v="£100.00" delay={10} />
      <Row k="Price" v="1.80" delay={16} />
      <Row k="Returns" v="£180.00" delay={22} />
      <Row k="Kick off" v="19:45" delay={28} />
      <div style={{
        marginTop: 22, fontFamily: F.ui, fontSize: 21, color: C.t3, lineHeight: 1.5,
      }}>Anything it cannot read, it names. It never guesses.</div>
    </Card>
  </Stage>
);

/* ---- beat three: you confirm ------------------------------------------- */
const Confirm: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = spring({ frame: f - 40, fps, config: { damping: 14, stiffness: 200 } });
  /* Pressed, then released. The scale dips and comes back, which is what a
     button does. */
  const scale = 1 - Math.sin(press * Math.PI) * 0.04;
  return (
    <Stage step="Three" title="You confirm.">
      <Card w={560}>
        <div style={{ fontFamily: F.ui, fontSize: 24, color: C.t2, marginBottom: 26, lineHeight: 1.5 }}>
          Nothing is written until you say so.
        </div>
        <div style={{
          transform: `scale(${scale})`, transformOrigin: 'left center',
          background: C.p, color: C.bg, borderRadius: 999, padding: '22px 0',
          textAlign: 'center', fontFamily: F.ui, fontWeight: 700, fontSize: 27,
        }}>Confirm</div>
      </Card>
    </Stage>
  );
};

/* ---- beat four: it settles --------------------------------------------- */
const Settle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 20, fps, config: { damping: 22, stiffness: 110 } });
  /* Counted up rather than cut to, because the number arriving is the point
     of the whole loop. */
  const value = Math.round(interpolate(s, [0, 1], [0, 8000])) / 100;
  return (
    <Stage step="Four" title="It settles itself.">
      <Card w={620}>
        <div style={{
          fontFamily: F.ui, fontSize: 22, letterSpacing: '.14em', textTransform: 'uppercase',
          color: C.t3, wordSpacing: '-.07em', marginBottom: 14,
        }}>Full time</div>
        <div style={{
          fontFamily: F.mono, fontSize: 78, fontWeight: 700, color: C.pos,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
        }}>+£{value.toFixed(2)}</div>
        <div style={{ marginTop: 18 }}>
          <Row k="Juventus v Cremonese" v="WON" tone={C.pos} delay={34} />
          <Row k="Today" v="+£112.00" tone={C.pos} delay={40} />
        </div>
      </Card>
    </Stage>
  );
};

const Sign: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 16], [0, 1], { extrapolateRight: 'clamp', easing: easeOut });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: o }}>
      <div style={{
        fontFamily: F.serif, fontWeight: 700, fontSize: 96, color: C.t1, letterSpacing: '-.03em',
      }}>Slippery</div>
      <div style={{ fontFamily: F.ui, fontSize: 30, color: C.t2, marginTop: 18 }}>
        A record you did not choose after the fact.
      </div>
      <div style={{ fontFamily: F.ui, fontSize: 20, color: C.t4, marginTop: 40 }}>
        18+ · BeGambleAware.org
      </div>
    </AbsoluteFill>
  );
};

export const Explainer: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Ribbons />
    <Beat from={0}><Send /></Beat>
    <Beat from={BEAT}><Read /></Beat>
    <Beat from={BEAT * 2}><Confirm /></Beat>
    <Beat from={BEAT * 3}><Settle /></Beat>
    <Sequence from={BEAT * 4 - 30}><Sign /></Sequence>
  </AbsoluteFill>
);
