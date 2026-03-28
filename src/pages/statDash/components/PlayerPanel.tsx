import React from 'react';
import type { TeamSide } from '../types';
import { cl } from '../utils/cl';

export interface PlayerPanelProps {
  side: TeamSide;
  accentColor: string;
  playerNumbers: number[];
  onPlayerClick: (side: TeamSide, jersey: number) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
}

const EXTRA = ['FOUL', 'TURNOVER'] as const;

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  side,
  accentColor,
  playerNumbers,
  onPlayerClick,
  onFoul,
  onTurnover,
}) => {
  const btnW = cl('44px', '4.8vw', '64px');

  return (
    <div
      className="flex shrink-0 flex-col font-sans"
      style={{
        gap: cl('3px', '0.4vw', '6px'),
        width: btnW,
      }}
    >
      {playerNumbers.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPlayerClick(side, n)}
          className="flex shrink-0 cursor-pointer select-none items-center justify-center border-none font-bold text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          style={{
            width: btnW,
            aspectRatio: '1',
            background: accentColor,
            fontSize: cl('16px', '1.9vw', '28px'),
            borderRadius: 4,
          }}
          aria-label={`${side} player number ${n}`}
        >
          {n}
        </button>
      ))}
      {EXTRA.map((lbl) => (
        <button
          key={lbl}
          type="button"
          onClick={() => (lbl === 'FOUL' ? onFoul(side) : onTurnover(side))}
          className="cursor-pointer border border-[#aaa] bg-[#e2e2e2] font-bold hover:bg-[#d8d8d8] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          style={{
            width: btnW,
            padding: `${cl('4px', '0.6vh', '9px')} 0`,
            fontSize:
              lbl === 'FOUL' ? cl('8px', '0.72vw', '10px') : cl('6px', '0.6vw', '8px'),
            letterSpacing: 0.3,
            borderRadius: 3,
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
};

export default PlayerPanel;
