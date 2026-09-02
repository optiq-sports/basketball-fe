import React from 'react';
import TeamScorecard from './TeamScorecard';
import GameTimer from './GameTimer';
import ActionButtons from './ActionButtons';
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
  onTimeout?: () => void;
  onJumpBall?: () => void;
  onSub?: () => void;
  reverseSides?: boolean;
  showQuarterFinish?: boolean;
  onQuarterFinish?: () => void;
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
    onTimeout,
    onJumpBall,
    onSub,
    reverseSides = false,
    showQuarterFinish = false,
    onQuarterFinish,
  } = props;

  return (
    <div
      className={`flex w-full items-stretch divide-x divide-gray-200 border-b border-gray-200 bg-white font-sans ${
        reverseSides ? 'flex-row-reverse' : ''
      }`}
    >
      <TeamScorecard
        teamName={homeName}
        score={homeScore}
        accentColor={homeColor}
        accentSide={reverseSides ? 'right' : 'left'}
      />
      <div
        className="flex min-w-0 shrink-0 flex-col items-stretch"
        style={{ minWidth: cl('200px', '26vw', '360px') }}
      >
        <GameTimer
          quarter={quarter}
          timerSeconds={timerSeconds}
          isRunning={isRunning}
          onStartStop={onStartStop}
          onTick={onTick}
          onAdjustMinutes={onAdjustMinutes}
          onAdjustSeconds={onAdjustSeconds}
          showQuarterFinish={showQuarterFinish}
          onQuarterFinish={onQuarterFinish}
        />
        <div
          className="w-full border-t border-gray-200 bg-gray-50"
          style={{ padding: cl('6px', '0.6vw', '10px') }}
        >
          <ActionButtons onTimeout={onTimeout} onJumpBall={onJumpBall} onSub={onSub} />
        </div>
      </div>
      <TeamScorecard
        teamName={awayName}
        score={awayScore}
        accentColor={awayColor}
        accentSide={reverseSides ? 'left' : 'right'}
      />
    </div>
  );
};

export default GameHeader;
