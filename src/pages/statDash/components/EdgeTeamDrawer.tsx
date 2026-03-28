import React from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { STAT_DASH } from '../statDashTheme';

/** MenuBar height — keep in sync with `MenuBar.tsx` */
const MENU_BAR_PX = 36;

/** Mock rows matching reference layout (same sample per row). */
const MOCK_ROWS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  num: 1,
  name: 'Ibrahim Maina',
  pf: 2,
  pts: 25,
}));

function TeamStatsTable({ teamName }: { teamName: string }) {
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
            <tr style={{ backgroundColor: STAT_DASH.homeRed }}>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-white">#</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-white">
                Player name
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-white">PF</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-white">PTS</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ROWS.map((row, idx) => (
              <tr key={row.id} className={idx % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                <td className="px-4 py-3.5 font-medium text-[#1E40AF]">{row.num}</td>
                <td className="px-4 py-3.5 font-medium text-[#1E40AF]">{row.name}</td>
                <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">{row.pf}</td>
                <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">{row.pts}</td>
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
}

/**
 * Hover the edge chevron to slide in a centered card (not full-height).
 * CSS-only (`group-hover`) — no React state in StatDash.
 */
const EdgeTeamDrawer: React.FC<EdgeTeamDrawerProps> = ({ edge, teamName }) => {
  const isLeft = edge === 'left';
  const Chevron = isLeft ? IoChevronBack : IoChevronForward;
  const label = isLeft ? 'Home team roster and stats' : 'Away team roster and stats';

  return (
    <div
      className={`group pointer-events-auto fixed bottom-0 z-40 flex items-stretch ${
        isLeft ? 'left-0 flex-row' : 'right-0 flex-row-reverse'
      }`}
      style={{ top: MENU_BAR_PX }}
      aria-label={label}
    >
      {/* Edge hit strip — full height */}
      <div className="flex w-9 shrink-0 items-center justify-center bg-[#f3f4f6]/90 sm:w-10">
        <span className="pointer-events-none flex" style={{ color: STAT_DASH.accentBlue }} aria-hidden>
          <Chevron size={18} />
        </span>
      </div>

      {/* Width rail: full height, card vertically centered inside */}
      <div
        className="flex h-full min-h-0 w-0 items-center overflow-hidden transition-[width] duration-300 ease-out group-hover:w-[min(100vw-2.5rem,22rem)]"
      >
        <div className="flex h-auto w-[min(100vw-2.5rem,22rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
          <TeamStatsTable teamName={teamName} />
        </div>
      </div>
    </div>
  );
};

export default EdgeTeamDrawer;
