import React, { useMemo } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import type { GameLogEntry } from '../types';
import { getContrastTextColor } from '../../../contexts/StatisticianTeamColorsContext';

/** MenuBar height — keep in sync with `MenuBar.tsx` */
const MENU_BAR_PX = 36;

function parseJerseyFromPlayerField(playerField: string): number | null {
  const s = playerField.trim();
  // Prefer leading jersey: "#5", "#12 (bench)"
  const leading = s.match(/^#(\d+)/);
  if (leading) {
    const n = Number(leading[1]);
    return Number.isFinite(n) ? n : null;
  }
  // Fallback: "Player #5", edited labels, etc.
  const any = s.match(/#(\d+)/);
  if (!any) return null;
  const n = Number(any[1]);
  return Number.isFinite(n) ? n : null;
}

function pointsFromShotResult(resultField: string): number {
  const r = resultField.toLowerCase();
  // "missed" contains substring "made" — check misses before makes.
  if (r.includes('missed') || /\bmiss\b/.test(r)) return 0;
  if (r.includes('3pt made')) return 3;
  if (r.includes('made')) return 2;
  return 0;
}

function freeThrowMakesFromFoulResult(resultField: string): {
  shooterJersey: number | null;
  makes: number;
} {
  const shooter = resultField.match(/Shooter\s*#(\d+)/i);
  const ftSeg = resultField.match(/FTs:\s*([^;]+)/i);
  if (!shooter || !ftSeg) return { shooterJersey: null, makes: 0 };
  const jersey = Number(shooter[1]);
  if (!Number.isFinite(jersey)) return { shooterJersey: null, makes: 0 };
  const makes = ftSeg[1]
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t === 'made').length;
  return { shooterJersey: jersey, makes };
}

/** Text between "on " and " #12;" in foul log lines — the fouled team label. */
function fouledTeamLabelFromFoulResult(resultField: string): string | null {
  const m = resultField.match(/\bon\s+(.+)\s+#\d+\s*;/i);
  return m?.[1]?.trim() ?? null;
}

function sameTeamName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function TeamStatsTable({
  teamName,
  teamColor,
  roster,
  entries,
}: {
  teamName: string;
  teamColor: string;
  roster: number[];
  entries: GameLogEntry[];
}) {
  const rosterSorted = useMemo(() => [...roster].sort((a, b) => a - b), [roster]);

  const statsByJersey = useMemo(() => {
    const pts: Record<number, number> = {};
    const pf: Record<number, number> = {};

    for (const n of rosterSorted) {
      pts[n] = 0;
      pf[n] = 0;
    }

    for (const e of entries) {
      if (e.action === 'foul') {
        const foulerJersey = parseJerseyFromPlayerField(e.player);
        if (foulerJersey !== null && sameTeamName(e.team, teamName)) {
          pf[foulerJersey] = (pf[foulerJersey] ?? 0) + 1;
        }
        // Row `team` is the fouler's team; FT points belong to the fouled team. Credit when this
        // drawer's team name matches the fouled team in the result and the shooter is on roster.
        const fouledLabel = fouledTeamLabelFromFoulResult(e.result);
        const { shooterJersey, makes } = freeThrowMakesFromFoulResult(e.result);
        if (
          makes > 0 &&
          shooterJersey !== null &&
          fouledLabel &&
          sameTeamName(fouledLabel, teamName) &&
          rosterSorted.includes(shooterJersey)
        ) {
          pts[shooterJersey] = (pts[shooterJersey] ?? 0) + makes;
        }
        continue;
      }

      if (!sameTeamName(e.team, teamName)) continue;
      const jersey = parseJerseyFromPlayerField(e.player);
      if (jersey === null) continue;

      if (e.action === 'shot') {
        pts[jersey] = (pts[jersey] ?? 0) + pointsFromShotResult(e.result);
      }
    }

    return { pts, pf };
  }, [entries, rosterSorted, teamName]);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="overflow-hidden">
        <table
          className="w-full border-collapse text-left text-sm"
          aria-label={`${teamName} player statistics`}
        >
          <caption className="sr-only">
            {teamName} — roster and stats
          </caption>
      <thead>
        <tr style={{ backgroundColor: teamColor }}>
          <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: getContrastTextColor(teamColor) }}>
            #
          </th>
          <th
            className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide"
            style={{ color: getContrastTextColor(teamColor) }}
          >
                Player name
              </th>
          <th
            className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide"
            style={{ color: getContrastTextColor(teamColor) }}
          >
            PF
          </th>
          <th
            className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide"
            style={{ color: getContrastTextColor(teamColor) }}
          >
            PTS
          </th>
            </tr>
          </thead>
          <tbody>
            {rosterSorted.map((n) => (
              <tr key={n} className={n % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                <td className="px-4 py-3.5 font-medium text-[#1E40AF]">{n}</td>
                <td className="px-4 py-3.5 font-medium text-[#1E40AF]">{`#${n}`}</td>
                <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">
                  {statsByJersey.pf[n] ?? 0}
                </td>
                <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">
                  {statsByJersey.pts[n] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface EdgeTeamDrawerProps {
  edge: 'left' | 'right';
  teamName: string;
  teamColor: string;
  roster: number[];
  entries: GameLogEntry[];
  open: boolean;
  onToggle: () => void;
}

/**
 * Click chevron to toggle side stats drawer.
 */
const EdgeTeamDrawer: React.FC<EdgeTeamDrawerProps> = ({
  edge,
  teamName,
  teamColor,
  roster,
  entries,
  open,
  onToggle,
}) => {
  const isLeft = edge === 'left';
  const Chevron = isLeft ? IoChevronBack : IoChevronForward;
  const label = isLeft ? 'Home team roster and stats' : 'Away team roster and stats';

  const strip = (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-9 shrink-0 cursor-pointer items-center justify-center bg-[#f3f4f6]/90 sm:w-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      aria-label={label}
    >
      <span className="pointer-events-none flex" style={{ color: teamColor }} aria-hidden>
        <Chevron size={18} />
      </span>
    </button>
  );

  const rail = (
    <div
      className={`flex h-full min-h-0 min-w-0 items-center overflow-hidden transition-[width] duration-300 ease-out ${
        open ? 'w-[min(100vw-2.5rem,22rem)]' : 'w-0'
      }`}
    >
      <div className="flex h-auto min-w-0 w-[min(100vw-2.5rem,22rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
        <TeamStatsTable teamName={teamName} teamColor={teamColor} roster={roster} entries={entries} />
      </div>
    </div>
  );

  return (
    <div
      className={`pointer-events-auto fixed bottom-0 z-40 flex items-stretch ${
        isLeft ? 'left-0 flex-row' : 'right-0 flex-row-reverse'
      }`}
      style={{ top: MENU_BAR_PX }}
    >
      {strip}
      {rail}
    </div>
  );
};

export default EdgeTeamDrawer;
