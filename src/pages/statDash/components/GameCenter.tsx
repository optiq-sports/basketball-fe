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
      className="flex min-h-0 flex-1 items-stretch font-sans"
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

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border-2 border-[#aaa]">
        <BasketballCourt />
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
