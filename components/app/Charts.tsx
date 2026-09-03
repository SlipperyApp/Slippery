'use client';

import { useId } from 'react';
import { useMeasure } from './useMeasure';
import { axisMoney, axisMonth, units as fmtUnits } from '@/lib/format';

/** Every chart here measures its own container before it draws. */

const PAD = { l: 4, r: 4, t: 8, b: 18 };

/** The curve, filling whatever box it is given.
 *
 *  It was a fixed 168px tall inside a module of 408, so a third of the
 *  module was chart and the rest was nothing: a picture with room for twice
 *  as much picture, in a layout whose whole argument is that the module
 *  heights are chosen. useMeasure already reported height and nobody read
 *  it. The prop stays as the FLOOR, for the places that render this outside
 *  a fixed height module. */
export function ProfitCurve({
  points, height: minHeight = 168, currency = 'GBP', unitMinor = 0,
}: {
  points: { day: string; netPence: number }[];
  height?: number;
  currency?: 'GBP' | 'EUR';
  /** Draw the end of the line in UNITS instead of money, and how many minor
   *  units make one. Set only by the public shared page, which has no
   *  currency to name: the only money on this chart is in its label, and a
   *  shared record does not carry one. See lib/data/share.ts. */
  unitMinor?: number;
}) {
  const { ref, width, height: boxH } = useMeasure<HTMLDivElement>();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const height = Math.max(minHeight, Math.round(boxH || 0));

  if (points.length < 2) {
    return (
      <div ref={ref} className="chartbox chartbox--fill" style={{ minHeight, display: 'grid', placeItems: 'center' }}>
        <p className="small dim">Two settled days draws a curve. There is one so far.</p>
      </div>
    );
  }

  const w = Math.max(120, width || 0);
  const innerW = w - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;

  const vals = points.map((p) => p.netPence);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.t + innerH - ((v - min) / span) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.netPence).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z`;
  const last = points[points.length - 1].netPence;
  const tone = last >= 0 ? 'var(--pos)' : 'var(--neg)';

  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div ref={ref} className="chartbox chartbox--fill">
      {width > 0 ? (
        <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img"
          aria-label={`Cumulative net, ending at ${unitMinor > 0 ? fmtUnits(last / unitMinor, { sign: true }) : axisMoney(last, currency)}`}>
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={PAD.l} x2={w - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={area} fill={`url(#g${id})`} />
          <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(points.length - 1)} cy={y(last)} r="3.5" fill={tone} />
          {ticks.map((i) => (
            <text key={i} className="axis" x={x(i)} y={height - 4}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>
              {axisMonth(points[i].day + 'T12:00:00Z')}
            </text>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export function Sparkline({ values, height = 34 }: { values: number[]; height?: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  if (values.length < 2) return <div ref={ref} className="chartbox" style={{ height }} />;
  const w = Math.max(60, width || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * w).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`).join(' ');
  const tone = values[values.length - 1] >= values[0] ? 'var(--pos)' : 'var(--neg)';
  return (
    <div ref={ref} className="chartbox" style={{ height }}>
      {width > 0 ? (
        <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} aria-hidden="true">
          <path d={d} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}

/** The row sparkline: a running total for ONE row of a breakdown, at a fixed
 *  size, with no measurement.
 *
 *  Deliberately not the Sparkline above. That one measures its container,
 *  which means a ResizeObserver per instance, and a breakdown with forty rows
 *  would install forty of them to draw forty things that are all the same
 *  width. Fixed width, no observer, one path.
 *
 *  The zero line is drawn whenever zero is inside the range, so a row that
 *  went two hundred up and came back to level does not look identical to a
 *  row that never moved. */
export function RowSpark({
  values, width = 74, height = 22, tone,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Overrides the end-versus-start read, for rows whose printed figure is
   *  the thing the colour has to agree with.
   *
   *  `ink` is the third answer and it is not a result colour at all: it draws
   *  in currentColor, for a line whose figure is NOT money won or lost. A
   *  turnover that goes up is not a profit, and drawing it in the profit
   *  green would be the one thing the two locked colours exist to prevent. */
  tone?: 'pos' | 'neg' | 'ink';
}) {
  if (values.length < 2) return <span className="rspark" aria-hidden="true" />;

  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const pad = 2.5;
  const h = height - pad * 2;

  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + h - ((v - min) / span) * h;

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const zeroY = y(0);
  const area = `${line} L${x(values.length - 1).toFixed(1)},${zeroY.toFixed(1)} L0,${zeroY.toFixed(1)} Z`;

  const last = values[values.length - 1];
  /*  `ink` first and on its own line: what follows is the shape the two
      result colours are allowed to be chosen by, which is the sign of the
      figure, and tests/contrast.test.ts reads these lines to keep it that
      way. A line that no longer mentions `tone` is a line that rule cannot
      recognise. */
  const plain = tone === 'ink';
  const c = plain ? 'currentColor' : (tone ?? (last >= 0 ? 'pos' : 'neg')) === 'pos' ? 'var(--pos)' : 'var(--neg)';

  return (
    <svg
      className="rspark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={area} fill={c} opacity="0.14" />
      {min < 0 && max > 0 ? (
        <line
          x1="0" x2={width} y1={zeroY} y2={zeroY}
          stroke="var(--line-2)" strokeWidth="1" strokeDasharray="2 2"
        />
      ) : null}
      <path d={line} fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={y(last)} r="1.9" fill={c} />
    </svg>
  );
}

/** Six periods, side by side, with the figure above each bar and the period
 *  under it.
 *
 *  IT REPLACED TWO MODULES AND THE ARGUMENT AGAINST BOTH IS THE SAME ONE. A
 *  "By month" list drew four rows of a month name and a money figure, which
 *  is a table pretending to be a chart: nothing about it is comparable at a
 *  glance and the fourth row was under the card's own edge. The trend bars on
 *  the tiles drew a shape with no axis, no labels and no zero line, so a
 *  losing month and a winning month were the same shape in a different
 *  colour.
 *
 *  A LOSING PERIOD HANGS BELOW THE LINE, which is the whole point of drawing
 *  it rather than listing it: down is down, at the length it was down by,
 *  next to the ones that were up. The zero line is drawn across the whole
 *  chart whether or not anything crosses it, because a chart whose baseline
 *  appears only when something is negative moves its own axis between two
 *  renders of the same account.
 *
 *  THE FIGURE IS ABOVE THE BAR AND NOT INSIDE IT. Inside, it has to fit the
 *  bar, so a short bar loses its own figure and the small numbers vanish;
 *  above, every one of the six is the same size and legible, and the bar is
 *  left to carry the comparison. A period with no settled bets prints nothing
 *  at all rather than a zero, because no bets and a break-even period are
 *  different facts and only one of them is worth a figure. */
export function PeriodBars({
  bars, currency = 'GBP',
}: {
  bars: { key: string; label: string; full: string; netPence: number; count: number; current: boolean }[];
  currency?: 'GBP' | 'EUR';
}) {
  if (!bars.length) return <p className="small dim">Nothing settled yet, so there is nothing to compare.</p>;
  const peak = Math.max(1, ...bars.map((b) => Math.abs(b.netPence)));

  return (
    <div className="pbars" role="img" aria-label={bars.map((b) => `${b.full}: ${b.count === 0 ? 'no bets' : axisMoney(b.netPence, currency)}`).join('. ')}>
      {bars.map((b) => {
        const up = b.netPence >= 0;
        /*  The share of the half height this bar takes. A period with bets
            that came out exactly level still draws a sliver, so it can be
            told from a period with nothing in it, which draws none. */
        const share = b.count === 0 ? 0 : Math.max(0.02, Math.abs(b.netPence) / peak);
        return (
          <div key={b.key} className={`pbar${b.current ? ' pbar--now' : ''}`}>
            <span className={`pbar__v tnum ${b.count === 0 ? 'dim' : up ? 'pos' : 'neg'}`}>
              {b.count === 0 ? '' : axisMoney(b.netPence, currency)}
            </span>
            <span className="pbar__plot" aria-hidden="true">
              <span className="pbar__half pbar__half--up">
                {up ? <span className="pbar__barfill pbar__barfill--pos" style={{ height: `${(share * 100).toFixed(1)}%` }} /> : null}
              </span>
              <span className="pbar__zero" />
              <span className="pbar__half pbar__half--down">
                {up ? null : <span className="pbar__barfill pbar__barfill--neg" style={{ height: `${(share * 100).toFixed(1)}%` }} />}
              </span>
            </span>
            <span className="pbar__k">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthBars({
  months, height = 150, currency = 'GBP',
}: {
  months: { key: string; label: string; netPence: number; count: number }[];
  height?: number;
  currency?: 'GBP' | 'EUR';
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  if (!months.length) return <div ref={ref} className="chartbox" style={{ height }} />;

  const w = Math.max(120, width || 0);
  const innerH = height - 26;
  const max = Math.max(1, ...months.map((m) => Math.abs(m.netPence)));
  const gap = 6;
  const bw = Math.max(6, (w - gap * (months.length - 1)) / months.length);
  const zero = innerH / 2 + 6;

  return (
    <div ref={ref} className="chartbox">
      {width > 0 ? (
        <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img"
          aria-label={`Month by month, ${months.length} months`}>
          <line x1="0" x2={w} y1={zero} y2={zero} stroke="var(--line-2)" strokeWidth="1" />
          {months.map((m, i) => {
            const h = (Math.abs(m.netPence) / max) * (innerH / 2 - 4);
            const up = m.netPence >= 0;
            return (
              <g key={m.key}>
                <rect
                  x={i * (bw + gap)} width={bw}
                  y={up ? zero - h : zero} height={Math.max(1.5, h)}
                  rx="2"
                  fill={up ? 'var(--pos)' : 'var(--neg)'}
                  opacity={m.count < 5 ? 0.4 : 0.92}
                >
                  <title>{`${m.label}: ${axisMoney(m.netPence, currency)} from ${m.count} bets`}</title>
                </rect>
                <text className="axis" x={i * (bw + gap) + bw / 2} y={height - 4} textAnchor="middle">{m.label}</text>
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
