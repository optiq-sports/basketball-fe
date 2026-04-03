import React from 'react';
import { jerseyAccentSurfaceStyle } from '../../../contexts/StatisticianTeamColorsContext';
import type { TeamSide } from '../types';
import { cl } from '../utils/cl';

export interface PlayerPanelProps {
  side: TeamSide;
  accentColor: string;
  playerNumbers: number[];
  /** When true, jersey and FOUL/TURNOVER actions are disabled (court flow active). */
  interactionsLocked?: boolean;
  /** Left-click: primary action based on active flow state */
  onPlayerFoulClick: (side: TeamSide, jersey: number) => void;
  /** Right-click: made-shot flow (caller must preventDefault on event) */
  onPlayerShotContextMenu: (side: TeamSide, jersey: number, e: React.MouseEvent) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
}

const EXTRA = ['FOUL', 'TURNOVER'] as const;

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  side,
  accentColor,
  playerNumbers,
  interactionsLocked = false,
  onPlayerFoulClick,
  onPlayerShotContextMenu,
  onFoul,
  onTurnover,
}) => {
  const btnW = cl('48px', '5.1vw', '68px');

  return (
    <div
      className="flex shrink-0 flex-col font-sans"
      style={{
        gap: cl('5px', '0.55vw', '8px'),
        width: btnW,
      }}
    >
      {playerNumbers.map((n, idx) => (
        <button
          key={`${side}-jersey-${idx}-${n}`}
          type="button"
          disabled={interactionsLocked}
          onClick={() => onPlayerFoulClick(side, n)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (interactionsLocked) return;
            onPlayerShotContextMenu(side, n, e);
          }}
          className="flex shrink-0 cursor-pointer select-none items-center justify-center border-none font-bold hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            ...jerseyAccentSurfaceStyle(accentColor),
            width: btnW,
            aspectRatio: '1',
            fontSize: cl('16px', '1.9vw', '28px'),
            borderRadius: 6,
          }}
          aria-label={`${side} player ${n}. Left-click: select player. Right-click: made shot.`}
        >
          {n}
        </button>
      ))}
      {EXTRA.map((lbl) => (
        <button
          key={lbl}
          type="button"
          onClick={() => (lbl === 'FOUL' ? onFoul(side) : onTurnover(side))}
          className="cursor-pointer border border-gray-400/90 bg-gray-200 font-bold uppercase tracking-wide text-gray-900 hover:bg-gray-300/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            width: btnW,
            padding: `${cl('5px', '0.55vh', '8px')} ${cl('2px', '0.2vw', '4px')}`,
            fontSize: cl('7px', '0.68vw', '10px'),
            letterSpacing: lbl === 'TURNOVER' ? 0.15 : 0.45,
            borderRadius: 6,
            lineHeight: 1.15,
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
};

export default PlayerPanel;
