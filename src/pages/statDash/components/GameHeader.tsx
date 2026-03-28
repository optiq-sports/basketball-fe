import React from 'react';
import TeamScorecard from './TeamScorecard';
import GameTimer from './GameTimer';
import ActionButtons from './ActionButtons';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

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
  } = props;

  const gap = cl('6px', '1vw', '14px');

  return (
    <div
      className="w-full rounded-xl border font-sans shadow-sm"
      style={{
        borderColor: STAT_DASH.cardBorder,
        background: 'rgba(243, 244, 246, 0.95)',
        padding: cl('8px', '1vw', '14px'),
      }}
    >
      <div className="flex items-stretch" style={{ gap }}>
        <TeamScorecard
          teamName={homeName}
          score={homeScore}
          accentColor={homeColor}
          accentSide="left"
        />
        <div
          className="flex min-w-0 shrink-0 flex-col items-stretch gap-2"
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
          />
          <div
            className="w-full rounded-lg"
            style={{
              background: 'rgba(229, 231, 235, 0.95)',
              padding: cl('6px', '0.6vw', '10px'),
            }}
          >
            <ActionButtons onTimeout={onTimeout} onJumpBall={onJumpBall} onSub={onSub} />
          </div>
        </div>
        <TeamScorecard
          teamName={awayName}
          score={awayScore}
          accentColor={awayColor}
          accentSide="right"
        />
      </div>
    </div>
  );
};

export default GameHeader;
