import React, { useMemo } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import type { GameLogEntry } from '../types';

/** MenuBar height — keep in sync with `MenuBar.tsx` */
const MENU_BAR_PX = 36;

function parseLeadingJersey(playerField: string): number | null {
  // Examples we might see:
  // "#5 M. Abdul" -> 5
  // "#12 (bench)" -> 12
  // "Bench" / "Coach" -> null
  const m = playerField.trim().match(/^#(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function pointsFromShotResult(resultField: string): number {
  // This app logs:
  // - "3pt made" as first part when it's a 3-pointer
  // - otherwise it logs "... shot made"
  if (resultField.includes('3pt made')) return 3;
  if (resultField.includes('made')) return 2;
  return 0;
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
  const statsByJersey = useMemo(() => {
    const pts: Record<number, number> = {};
    const pf: Record<number, number> = {};

    for (const n of roster) {
      pts[n] = 0;
      pf[n] = 0;
    }

    for (const e of entries) {
      if (e.team !== teamName) continue;
      const jersey = parseLeadingJersey(e.player);
      if (jersey === null) continue;

      if (e.action === 'shot') {
        pts[jersey] = (pts[jersey] ?? 0) + pointsFromShotResult(e.result);
      } else if (e.action === 'foul') {
        // PF column is total fouls committed (personal/tech/etc combined).
        pf[jersey] = (pf[jersey] ?? 0) + 1;
      }
    }

    return { pts, pf };
  }, [entries, roster, teamName]);

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
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-white">#</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-white">
                Player name
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-white">PF</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-white">PTS</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((n) => (
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
}

/**
 * Hover the edge chevron to slide in a centered card (not full-height).
 * CSS-only (`group-hover`) — no React state in StatDash.
 */
const EdgeTeamDrawer: React.FC<EdgeTeamDrawerProps> = ({
  edge,
  teamName,
  teamColor,
  roster,
  entries,
}) => {
  const isLeft = edge === 'left';
  const Chevron = isLeft ? IoChevronBack : IoChevronForward;
  const label = isLeft ? 'Home team roster and stats' : 'Away team roster and stats';

  const strip = (
    <div className="flex w-9 shrink-0 items-center justify-center bg-[#f3f4f6]/90 sm:w-10">
      <span className="pointer-events-none flex" style={{ color: teamColor }} aria-hidden>
        <Chevron size={18} />
      </span>
    </div>
  );

  const rail = (
    <div className="flex h-full min-h-0 min-w-0 w-0 items-center overflow-hidden transition-[width] duration-300 ease-out group-hover:w-[min(100vw-2.5rem,22rem)]">
      <div className="flex h-auto min-w-0 w-[min(100vw-2.5rem,22rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
        <TeamStatsTable teamName={teamName} teamColor={teamColor} roster={roster} entries={entries} />
      </div>
    </div>
  );

  return (
    <div
      className={`group pointer-events-auto fixed bottom-0 z-40 flex flex-row-reverse items-stretch ${
        isLeft ? 'left-0' : 'right-0'
      }`}
      style={{ top: MENU_BAR_PX }}
      aria-label={label}
    >
      {isLeft ? (
        <>
          {rail}
          {strip}
        </>
      ) : (
        <>
          {strip}
          {rail}
        </>
      )}
    </div>
  );
};

export default EdgeTeamDrawer;
