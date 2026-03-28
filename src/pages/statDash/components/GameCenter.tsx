import React from 'react';
import type { TeamSide } from '../types';
import PlayerPanel from './PlayerPanel';
import BasketballCourt from './BasketballCourt';
import { cl } from '../utils/cl';
import { STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from '../statDashTheme';

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
    <div className={`${STAT_DASH_MAIN_OUTER} min-h-0 flex-1 items-start font-sans`}>
      <div
        className={`${STAT_DASH_MAIN_INNER} items-start`}
        style={{ gap: cl('12px', '1.4vw', '24px') }}
      >
        <PlayerPanel
          side="home"
          accentColor={homeColor}
          playerNumbers={homePlayers}
          onPlayerClick={onPlayerClick}
          onFoul={onFoul}
          onTurnover={onTurnover}
        />

        {/* Court ~60–70% width at max row; margin from side columns matches reference */}
        <div className="flex min-w-0 flex-[1.35] justify-center px-0 sm:px-0.5">
          <div className="aspect-[620/380] w-full max-w-full shrink-0 overflow-hidden rounded-lg border-[3px] border-gray-500 bg-[#d8dce1] shadow-sm">
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
    </div>
  );
};

export default GameCenter;
