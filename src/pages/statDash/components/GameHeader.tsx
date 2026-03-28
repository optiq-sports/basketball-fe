import React from 'react';
import TeamScorecard from './TeamScorecard';
import GameTimer from './GameTimer';
import { cl } from '../utils/cl';

export interface GameHeaderProps {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeColor: string;
  awayColor: string;
  quarter: number;
  timerSeconds: number;
  isRunning: boolean;
  onStartStop: () => void;
  onTick: () => void;
  onAdjustMinutes: (deltaSeconds: number) => void;
  onAdjustSeconds: (deltaSeconds: number) => void;
}

const GameHeader: React.FC<GameHeaderProps> = (props) => {
  const {
    homeName,
    awayName,
    homeScore,
    awayScore,
    homeColor,
    awayColor,
    quarter,
    timerSeconds,
    isRunning,
    onStartStop,
    onTick,
    onAdjustMinutes,
    onAdjustSeconds,
  } = props;

  return (
    <div
      className="flex items-stretch font-sans"
      style={{ gap: cl('6px', '1vw', '14px') }}
    >
      <TeamScorecard teamName={homeName} score={homeScore} borderColor={homeColor} />
      <GameTimer
        quarter={quarter}
        timerSeconds={timerSeconds}
        isRunning={isRunning}
        onStartStop={onStartStop}
        onTick={onTick}
        onAdjustMinutes={onAdjustMinutes}
        onAdjustSeconds={onAdjustSeconds}
      />
      <TeamScorecard teamName={awayName} score={awayScore} borderColor={awayColor} />
    </div>
  );
};

export default GameHeader;
