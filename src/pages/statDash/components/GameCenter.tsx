import React from 'react';
import type { TeamSide } from '../types';
import PlayerPanel from './PlayerPanel';
import BasketballCourt from './BasketballCourt';
import { cl } from '../utils/cl';

export interface GameCenterProps {
  homeColor: string;
  awayColor: string;
  homePlayers: number[];
  awayPlayers: number[];
  onPlayerClick: (side: TeamSide, jersey: number) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
}

const GameCenter: React.FC<GameCenterProps> = ({
  homeColor,
  awayColor,
  homePlayers,
  awayPlayers,
  onPlayerClick,
  onFoul,
  onTurnover,
}) => {
  return (
    <div
      className="flex min-h-0 flex-1 items-start justify-center font-sans"
      style={{ gap: cl('6px', '0.8vw', '12px') }}
    >
      <PlayerPanel
        side="home"
        accentColor={homeColor}
        playerNumbers={homePlayers}
        onPlayerClick={onPlayerClick}
        onFoul={onFoul}
        onTurnover={onTurnover}
      />

      {/* Compact court between sidebars (reference: height ~ jersey column, not full viewport) */}
      <div className="flex min-w-0 flex-1 justify-center px-0 sm:px-1">
        <div className="aspect-[620/380] w-full max-w-[min(100%,520px)] shrink-0 overflow-hidden rounded-lg border-2 border-gray-500 bg-[#c8cdd2] shadow-sm">
          <BasketballCourt />
        </div>
      </div>

      <PlayerPanel
        side="away"
        accentColor={awayColor}
        playerNumbers={awayPlayers}
        onPlayerClick={onPlayerClick}
        onFoul={onFoul}
        onTurnover={onTurnover}
      />
    </div>
  );
};

export default GameCenter;
