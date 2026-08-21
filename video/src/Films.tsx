import React from 'react';
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring,
} from 'remotion';
import { C, F } from './theme';
import { BEAT, Beat, Card, Frame, Pill, Row, SignOff, Stage, useVertical, easeOut } from './kit';

/* ═══════════════════════════════════════════════════════════════════════════
 * FIVE FILMS, ONE GRAMMAR.
 *
 * These replace the landing page's five storyboards: the six-scene autoplay
 * deck, the Telegram preview, the import deck, the social deck and the
 * settlement carousel. Each was a stack of absolutely positioned DOM with
 * its own timer, its own arrows and its own dots, and between them they were
 * most of the thirty eight infinite animations the page was running.
 *
 * Everything here is drawn from the product's own rules. The settlement film
 * in particular is the locked table, not an illustration of it: whole lines
 * push, quarter lines split, void returns the stake.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ---------- shared small parts ------------------------------------------ */

const Slip: React.FC<{ book: string; legs: [string, string?][]; stake: string; ret: string; scan?: boolean }> =
({ book, legs, stake, ret, scan }) => {
  const f = useCurrentFrame();
  const { height } = useVideoConfig();
  const y = interpolate(f % 90, [0, 89], [0, 1]) * 100;
  return (
    <Card w={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <b style={{ fontFamily: F.ui, fontSize: 33, color: C.t1 }}>{book}</b>
        <Pill text="SLIP" />
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
        {legs.map(([name, mkt], i) => {
          const s = spring({ frame: f - 10 - i * 6, fps: 30, config: { damping: 18, stiffness: 120 } });
          return (
            <div key={name} style={{
              display: 'flex', gap: 20, alignItems: 'center', padding: '16px 0',
              opacity: s, transform: `translateX(${(1 - s) * -12}px)`,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 11, flex: '0 0 auto',
                border: `2px solid ${C.s}`, background: `${C.s}33`,
              }} />
              <div>
                <div style={{ fontFamily: F.ui, fontSize: 31, color: C.t1 }}>{name}</div>
                {mkt ? <div style={{ fontFamily: F.ui, fontSize: 25, color: C.t3 }}>{mkt}</div> : null}
              </div>
            </div>
          );
        })}
        {scan ? (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 3,
            background: `linear-gradient(90deg, transparent, ${C.s}, transparent)`,
          }} />
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
        <div><div style={{ fontFamily: F.ui, fontSize: 25, color: C.t3 }}>Stake</div>
          <b style={{ fontFamily: F.mono, fontSize: 36, color: C.t1 }}>{stake}</b></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontFamily: F.ui, fontSize: 25, color: C.t3 }}>Returns</div>
          <b style={{ fontFamily: F.mono, fontSize: 36, color: C.t1 }}>{ret}</b></div>
      </div>
    </Card>
  );
};

const Bubble: React.FC<{ text: string; mine?: boolean; delay?: number }> = ({ text, mine, delay = 0 }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f - delay, fps: 30, config: { damping: 19, stiffness: 130 } });
  return (
    <div style={{
      alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%',
      background: mine ? C.p : C.elev, color: mine ? C.bg : C.t1,
      border: mine ? 'none' : `1px solid ${C.line}`,
      borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6,
      padding: '20px 26px', fontFamily: F.ui, fontSize: 31, lineHeight: 1.38,
      opacity: s, transform: `translateY(${(1 - s) * 14}px) scale(${0.96 + s * 0.04})`,
    }}>{text}</div>
  );
};

/* A figure that counts to its value rather than appearing at it. */
const Count: React.FC<{ to: number; prefix?: string; tone?: string; size?: number }> =
({ to, prefix = '', tone, size = 104 }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [6, 44], [0, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });
  const sign = to >= 0 ? '+' : '−';
  return (
    <div style={{
      fontFamily: F.mono, fontWeight: 700, fontSize: size, letterSpacing: '-.03em',
      color: tone ?? (to >= 0 ? C.pos : C.neg), fontVariantNumeric: 'tabular-nums',
    }}>{sign}{prefix}{Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
  );
};

/* ═══ 1. IN ACTION ═══════════════════════════════════════════════════════ */

export const InAction: React.FC = () => (
  <Frame>
    <Beat from={0}>
      <Stage step="01 / 04" title="Your record, honestly.">
        <Card w={640}>
          <div style={{ fontFamily: F.ui, fontSize: 26, letterSpacing: '.14em', color: C.t3, textTransform: 'uppercase', marginBottom: 14 }}>Net this month</div>
          <Count to={962.5} prefix="£" />
          <div style={{ display: 'flex', gap: 42, marginTop: 26 }}>
            <span style={{ fontFamily: F.ui, fontSize: 30, color: C.t2 }}>Bets <b style={{ fontFamily: F.mono, color: C.t1 }}>96</b></span>
            <span style={{ fontFamily: F.ui, fontSize: 30, color: C.t2 }}>Units <b style={{ fontFamily: F.mono, color: C.pos }}>+38.5u</b></span>
          </div>
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT}>
      <Stage step="02 / 04" title="Every bet, one line each.">
        <Card w={640}>
          <Row first k="Arsenal to win" v="+£9.00" tone={C.pos} delay={4} />
          <Row k="Inter" v="−£25.00" tone={C.neg} delay={10} />
          <Row k="Both teams to score" v="+£37.75" tone={C.pos} delay={16} />
          <Row k="Bayern −1" v="+£93.50" tone={C.pos} delay={22} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 2}>
      <Stage step="03 / 04" title="A month you can read at a glance.">
        <Grid />
      </Stage>
    </Beat>
    <Beat from={BEAT * 3}>
      <Stage step="04 / 04" title="What is still running, and what it is worth.">
        <Card w={640}>
          <Row first k="Chelsea v Newcastle" v="£100 open" text tone={C.a} delay={4} />
          <Row k="Kempton 19:45" v="£20 open" text tone={C.a} delay={10} />
          <Row k="At risk" v="£120.00" tone={C.a} delay={18} />
        </Card>
      </Stage>
    </Beat>
    <Sequence from={BEAT * 4 - 30}><SignOff line="Logged when you place it, not when it wins." /></Sequence>
  </Frame>
);

const Grid: React.FC = () => {
  const f = useCurrentFrame();
  const vertical = useVertical();
  const vals = [186, -58, 264, -96, 64, 0, 212, -74, 148, 0, -41, 238, 0, 229, 112, 0, 0, -33, 91, 0, 175];
  const cell = vertical ? 74 : 68;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, width: cell * 7 + 72, maxWidth: '100%' }}>
      {vals.map((v, i) => {
        const s = spring({ frame: f - 6 - i * 1.6, fps: 30, config: { damping: 20, stiffness: 140 } });
        const tone = v > 0 ? C.pos : v < 0 ? C.neg : C.t4;
        return (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: 12,
            border: `1px solid ${v ? tone + '55' : C.line}`,
            background: v ? tone + '1F' : 'transparent',
            display: 'grid', placeItems: 'center',
            fontFamily: F.mono, fontSize: 21, fontWeight: 700, color: v ? tone : C.t4,
            opacity: s, transform: `scale(${0.86 + s * 0.14})`,
          }}>{v ? (v > 0 ? '+' : '−') + Math.abs(v) : '·'}</div>
        );
      })}
    </div>
  );
};

/* ═══ 2. THE BOT ═════════════════════════════════════════════════════════ */

export const Bot: React.FC = () => (
  <Frame>
    <Beat from={0}>
      <Stage step="Telegram" title="Forward the slip. That is the whole job.">
        <Card w={660}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Bubble text="Sent a screenshot" mine delay={6} />
            <Bubble text="Read it. Juventus v Cremonese, 4 legs, £100 at 1.80. Save it?" delay={22} />
            <Bubble text="Yes" mine delay={44} />
          </div>
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT}>
      <Stage step="Three steps, once" title="Link it, then never think about it.">
        <Card w={660}>
          <Row first k="Create an account" v="You get a code" text delay={4} />
          <Row k="Paste it to the bot" v="One time only" text delay={12} />
          <Row k="Forward slips" v="Or add it to a group" text delay={20} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 2}>
      <Stage step="It answers" title="Ask it anything your ledger knows.">
        <Card w={660}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Bubble text="/today" mine delay={6} />
            <Bubble text="3 bets, 2 settled. +£112.00, +4.48u. One still running: Kempton 19:45, £20." delay={24} />
          </div>
        </Card>
      </Stage>
    </Beat>
    <Sequence from={BEAT * 3 - 30}><SignOff line="@SlipperyAppBot. Private chat or group." /></Sequence>
  </Frame>
);

/* ═══ 3. IMPORT ══════════════════════════════════════════════════════════ */

export const Importing: React.FC = () => (
  <Frame>
    <Beat from={0}>
      <Stage step="01 / 03" title="Bring the history you already have.">
        <Card w={640}>
          <Row first k="CSV from another tracker" v="Any columns" text delay={4} />
          <Row k="A bookmaker statement" v="PDF or CSV" text delay={12} />
          <Row k="Screenshots of old slips" v="Several at once" text delay={20} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT}>
      <Stage step="02 / 03" title="Every row read, nothing assumed.">
        <Card w={640}>
          <Row first k="Rows found" v="1,284" delay={4} />
          <Row k="Read cleanly" v="1,268" tone={C.pos} delay={11} />
          <Row k="Duplicates flagged" v="14" tone={C.a} delay={18} />
          <Row k="Need a decision" v="2" tone={C.a} delay={25} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 2}>
      <Stage step="03 / 03" title="Kept apart from what you log now.">
        <Card w={640}>
          <div style={{ fontFamily: F.ui, fontSize: 32, color: C.t2, lineHeight: 1.42 }}>
            Imported figures move net, turnover and the calendar.
          </div>
          <div style={{ height: 18 }} />
          <div style={{ fontFamily: F.ui, fontSize: 32, color: C.t1, lineHeight: 1.42 }}>
            They never touch win rate, streaks, or best and worst day — there is no slip behind them.
          </div>
        </Card>
      </Stage>
    </Beat>
    <Sequence from={BEAT * 3 - 30}><SignOff line="No column mapping to learn." /></Sequence>
  </Frame>
);

/* ═══ 4. SOCIAL ══════════════════════════════════════════════════════════ */

export const Social: React.FC = () => (
  <Frame>
    <Beat from={0}>
      <Stage step="Groups" title="Ranked in units, not in pounds.">
        <Card w={660}>
          <Row first k="1  BlueSlip" v="+18.2u" tone={C.pos} delay={4} />
          <Row k="2  KerryEdge" v="+11.7u" tone={C.pos} delay={11} />
          <Row k="3  You" v="+8.4u" tone={C.pos} delay={18} />
          <Row k="4  FiveFolds" v="−2.1u" tone={C.neg} delay={25} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT}>
      <Stage step="Why units" title="A £5 bettor and a £500 one compare properly.">
        <Card w={660}>
          <Row first k="£10 stake, won at 1.90" v="+0.36u" tone={C.pos} delay={4} />
          <Row k="£500 stake, won at 1.90" v="+0.36u" tone={C.pos} delay={14} />
          <Row k="Same call, same score" v="—" text delay={24} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 2}>
      <Stage step="Private by default" title="Nothing is shared until you say so.">
        <Card w={660}>
          <Row first k="Private" v="Nothing leaves" text delay={4} />
          <Row k="Friends only" v="People you follow back" text delay={12} />
          <Row k="Public" v="Anyone, if you choose it" text delay={20} />
        </Card>
      </Stage>
    </Beat>
    <Sequence from={BEAT * 3 - 30}><SignOff line="Slip-backed bets only, if the group asks for it." /></Sequence>
  </Frame>
);

/* ═══ 5. SETTLEMENT ══════════════════════════════════════════════════════ */

/* THE LOCKED TABLE, NOT AN ILLUSTRATION OF IT. Every line here is a rule
   from the settlement engine, and if one changes this film is wrong. */
export const Settling: React.FC = () => (
  <Frame>
    <Beat from={0}>
      <Stage step="Six outcomes" title="Every slip lands in one of six places.">
        <Card w={680}>
          <Row first k="Won" v="Stake back, plus profit" text tone={C.pos} delay={4} />
          <Row k="Lost" v="Stake gone" text tone={C.neg} delay={9} />
          <Row k="Void" v="Stake back, £0 profit" text delay={14} />
          <Row k="Cash out" v="What you actually took" text tone={C.a} delay={19} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT}>
      <Stage step="Whole lines" title="Over 2.0 on a 1–1 is a push, not a loss.">
        <Card w={680}>
          <Row first k="Over 2.0 · final 1–1" v="Void" text delay={4} />
          <Row k="Over 2.25 · final 1–1" v="Half lost" text tone={C.a} delay={12} />
          <Row k="Over 2.5 · final 1–1" v="Lost" text tone={C.neg} delay={20} />
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 2}>
      <Stage step="Ninety minutes" title="Extra time and penalties never count.">
        <Card w={680}>
          <div style={{ fontFamily: F.ui, fontSize: 32, color: C.t2, lineHeight: 1.42 }}>
            If the feed cannot prove the score at ninety minutes, the bet is not graded.
          </div>
          <div style={{ height: 20 }} />
          <div style={{ fontFamily: F.serif, fontWeight: 700, fontSize: 46, color: C.t1, lineHeight: 1.2 }}>
            A wrong grade is worse than no grade.
          </div>
        </Card>
      </Stage>
    </Beat>
    <Beat from={BEAT * 3}>
      <Stage step="It asks" title="When it is not sure, it says so.">
        <Card w={680}>
          <Row first k="Player props" v="Always asks" text tone={C.a} delay={4} />
          <Row k="Anytime scorer" v="Always asks" text tone={C.a} delay={10} />
          <Row k="Bet builders" v="Always asks" text tone={C.a} delay={16} />
          <Row k="Cash out" v="Only you know" text tone={C.a} delay={22} />
        </Card>
      </Stage>
    </Beat>
    <Sequence from={BEAT * 4 - 30}><SignOff line="Settled by rule, not by guess." /></Sequence>
  </Frame>
);

/* Length per film, so Root and the render script agree with the component. */
export const LENGTHS = {
  InAction: BEAT * 4 + 60,
  Bot: BEAT * 3 + 60,
  Importing: BEAT * 3 + 60,
  Social: BEAT * 3 + 60,
  Settling: BEAT * 4 + 60,
} as const;
