import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, F } from './theme';
import { BEAT, Beat, Card, Frame, Row, Stage, useVertical, easeOut } from './kit';

/* THREE STEPS, BECAUSE THE SECTION ABOVE IT SAYS THREE STEPS.
 *
 * The first cut had four beats — send, read, confirm, settle — sitting under
 * a heading that reads "Three steps, then it runs itself" and a list of
 * exactly three. A film that does not depict the section it is under is
 * worse than no film: the reader spends the clip trying to reconcile it.
 *
 * The three are the section's own, word for word: send the screenshot, it
 * reads every leg, you confirm and it tracks. Settling is inside the third,
 * where the copy puts it.
 *
 * It runs on the same kit as the other five, so all six move identically.
 */

/* ---- one: send the screenshot ------------------------------------------ */
const Send: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fly = spring({ frame: f - 20, fps, config: { damping: 20, stiffness: 90 } });
  return (
    <Stage step="01" title="Send the screenshot.">
      <Card w={820}>
        <div style={{
          fontFamily: F.mono, fontSize: 30, color: C.t3, marginBottom: 24, letterSpacing: '.04em',
        }}>TELEGRAM</div>
        <div style={{
          transform: `translateY(${(1 - fly) * 26}px)`, opacity: fly,
          background: C.elev, border: `1px solid ${C.line}`, borderRadius: 18, padding: 30,
        }}>
          <div style={{ fontFamily: F.ui, fontSize: 38, color: C.t1, marginBottom: 12 }}>
            Juventus v Cremonese
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 33, color: C.t2 }}>
            4 legs · 1.80 · £100.00
          </div>
        </div>
        <div style={{ marginTop: 26, fontFamily: F.ui, fontSize: 32, color: C.t3 }}>
          One slip or several at once.
        </div>
      </Card>
    </Stage>
  );
};

/* ---- two: it reads every leg ------------------------------------------- */
const Read: React.FC = () => (
  <Stage step="02" title="It reads every leg.">
    <Card w={900}>
      <div style={{
        fontFamily: F.mono, fontSize: 30, color: C.s, marginBottom: 10, letterSpacing: '.04em',
      }}>READ · 4 LEGS · BET365</div>
      <Row k="Stake" v="£100.00" delay={10} />
      <Row k="Price" v="1.80" delay={16} />
      <Row k="Returns" v="£180.00" delay={22} />
      <Row k="Kick off" v="19:45" delay={28} />
      <div style={{ marginTop: 26, fontFamily: F.ui, fontSize: 31, color: C.t3, lineHeight: 1.45 }}>
        Anything it cannot read, it names. It never guesses.
      </div>
    </Card>
  </Stage>
);

/* ---- three: you confirm, it tracks ------------------------------------- */
const Confirm: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = spring({ frame: f - 26, fps, config: { damping: 14, stiffness: 200 } });
  /* Pressed, then released: the scale dips and comes back, which is what a
     button does. */
  const scale = 1 - Math.sin(press * Math.PI) * 0.04;
  const settled = spring({ frame: f - 62, fps, config: { damping: 22, stiffness: 110 } });
  const value = Math.round(interpolate(settled, [0, 1], [0, 8000])) / 100;
  return (
    <Stage step="03" title="You confirm, it tracks.">
      <Card w={900}>
        <div style={{
          transform: `scale(${scale})`, transformOrigin: 'center',
          background: C.p, color: C.bg, borderRadius: 999, padding: '26px 0',
          textAlign: 'center', fontFamily: F.ui, fontWeight: 700, fontSize: 38,
        }}>Confirm</div>
        <div style={{
          marginTop: 30, opacity: settled, transform: `translateY(${(1 - settled) * 14}px)`,
        }}>
          <div style={{
            fontFamily: F.ui, fontSize: 28, letterSpacing: '.14em', textTransform: 'uppercase',
            color: C.t3, wordSpacing: '-.07em', marginBottom: 12,
          }}>Full time, settled itself</div>
          <div style={{
            fontFamily: F.mono, fontSize: 96, fontWeight: 700, color: C.pos,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
          }}>+£{value.toFixed(2)}</div>
        </div>
      </Card>
    </Stage>
  );
};

const Sign: React.FC = () => {
  const f = useCurrentFrame();
  const vertical = useVertical();
  const o = interpolate(f, [0, 16], [0, 1], { extrapolateRight: 'clamp', easing: easeOut });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: o, padding: 60 }}>
      <div style={{
        fontFamily: F.serif, fontWeight: 700, fontSize: vertical ? 88 : 96, color: C.t1,
        letterSpacing: '-.03em',
      }}>Slippery</div>
      <div style={{
        fontFamily: F.ui, fontSize: vertical ? 34 : 36, color: C.t2, marginTop: 20,
        textAlign: 'center', maxWidth: '30ch',
      }}>A record you did not choose after the fact.</div>
      <div style={{ fontFamily: F.ui, fontSize: 26, color: C.t4, marginTop: 44 }}>
        18+ · BeGambleAware.org
      </div>
    </AbsoluteFill>
  );
};

export const Explainer: React.FC = () => (
  <Frame>
    <Beat from={0}><Send /></Beat>
    <Beat from={BEAT}><Read /></Beat>
    <Beat from={BEAT * 2}><Confirm /></Beat>
    <Sequence from={BEAT * 3 - 30}><Sign /></Sequence>
  </Frame>
);

/* Three beats plus the sign-off, rather than the four the first cut ran. */
export const EXPLAINER_LENGTH = BEAT * 3 + 60;
