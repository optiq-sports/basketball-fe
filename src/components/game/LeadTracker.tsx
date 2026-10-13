import React from 'react';
import { clockText, periodLabel, type LeadSummary } from '../../lib/timeline-stats';
import type { TeamSide } from './ComparisonBars';

const W = 640;
const H = 220;
const PAD = { l: 8, r: 36, t: 20, b: 8 };

/** The score margin over the game as bars: home above the line, away below, with the story under it. */
export function LeadTracker({ summary, home, away }: { summary: LeadSummary; home: TeamSide; away: TeamSide }) {
  const { series, biggestLead, biggestRun, timeLeading, leadChanges, timesTied } = summary;
  if (series.length === 0) return <p className="text-sm text-gray-500">No scoring yet.</p>;

  const peak = Math.max(10, ...series.map((p) => Math.abs(p.margin)));
  const limit = Math.ceil(peak / 10) * 10;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const mid = PAD.t + plotH / 2;
  const barW = Math.max(1.5, plotW / series.length - 1);
  const x = (i: number) => PAD.l + (i / series.length) * plotW;
  const y = (m: number) => (m / limit) * (plotH / 2);

  const starts: Array<{ period: number; i: number }> = [];
  series.forEach((p, i) => { if (i === 0 || p.period !== series[i - 1].period) starts.push({ period: p.period, i }); });

  const rows: Array<[string, string, string]> = [
    [String(biggestLead.home), 'Biggest lead', String(biggestLead.away)],
    [`${biggestRun.home}-0`, 'Biggest scoring run', `${biggestRun.away}-0`],
    [clockText(timeLeading.home), 'Time leading', clockText(timeLeading.away)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lead tracker: biggest lead ${home.name} ${biggestLead.home}, ${away.name} ${biggestLead.away}; the lead changed hands ${leadChanges} times.`} className="block h-auto w-full">
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH / 2} className="fill-gray-50 dark:fill-gray-800/40" />
        <rect x={PAD.l} y={mid} width={plotW} height={plotH / 2} className="fill-gray-50 dark:fill-gray-800/40" />
        <line x1={PAD.l} x2={PAD.l + plotW} y1={mid} y2={mid} className="stroke-gray-400" strokeWidth={1} />
        {starts.map((s) => (
          <g key={s.period}>
            {s.i > 0 && <line x1={x(s.i)} x2={x(s.i)} y1={PAD.t} y2={PAD.t + plotH} className="stroke-gray-300 dark:stroke-gray-700" strokeWidth={1} />}
            <text x={x(s.i) + 4} y={13} className="fill-gray-500 text-[10px] font-semibold">{periodLabel(s.period)}</text>
          </g>
        ))}
        {series.map((p, i) => (
          <rect key={i} x={x(i)} width={barW} y={p.margin >= 0 ? mid - y(p.margin) : mid} height={Math.abs(y(p.margin))} fill={p.margin >= 0 ? home.color : away.color} />
        ))}
        {[limit, limit / 2, 0, -limit / 2, -limit].map((v) => (
          <text key={v} x={PAD.l + plotW + 6} y={mid - (v / limit) * (plotH / 2) + 3} className="fill-gray-500 text-[10px]">{Math.abs(v)}</text>
        ))}
      </svg>

      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: home.color }} />{home.name}</span>
        <span className="flex items-center gap-2">{away.name}<span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: away.color }} /></span>
      </div>
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(([h, label, a]) => (
          <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 text-sm">
            <dd className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{h}</dd>
            <dt className="text-center text-xs text-gray-500">{label}</dt>
            <dd className="text-right text-lg font-bold tabular-nums text-gray-900 dark:text-white">{a}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
        <p className="text-center"><span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{leadChanges}</span> <span className="text-xs uppercase tracking-wide text-gray-500">lead changes</span></p>
        <p className="text-center"><span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{timesTied}</span> <span className="text-xs uppercase tracking-wide text-gray-500">times tied</span></p>
      </div>
    </div>
  );
}
