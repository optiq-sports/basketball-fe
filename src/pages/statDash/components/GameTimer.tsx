import React, { useEffect } from 'react';
import { IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { getContrastTextColor, jerseyAccentSurfaceStyle } from '../../../contexts/StatisticianTeamColorsContext';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';
import { REGULATION_QUARTERS } from '../periodLabel';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';

export interface GameTimerProps {
  quarter: number;
  timerSeconds: number;
  isRunning: boolean;
  onStartStop: () => void;
  onTick: () => void;
  onAdjustMinutes: (deltaSeconds: number) => void;
  onAdjustSeconds: (deltaSeconds: number) => void;
  /** After quarter-ended "Not yet": show yellow Finish instead of Start/Stop. */
  showQuarterFinish?: boolean;
  onQuarterFinish?: () => void;
}

const chevronSize = 13;

export function quarterLabel(q: number): string {
  if (q > REGULATION_QUARTERS) {
    const ot = q - REGULATION_QUARTERS;
    return ot === 1 ? 'OVERTIME' : `OVERTIME ${ot}`;
  }
  const suffix = q === 1 ? 'st' : q === 2 ? 'nd' : q === 3 ? 'rd' : 'th';
  return `${q}${suffix} QUARTER`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const FINISH_YELLOW = STAT_DASH.awayYellow;

const GameTimer: React.FC<GameTimerProps> = ({
  quarter,
  timerSeconds,
  isRunning,
  onStartStop,
  onTick,
  onAdjustMinutes,
  onAdjustSeconds,
  showQuarterFinish = false,
  onQuarterFinish,
}) => {
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => onTick(), 1000);
    return () => window.clearInterval(id);
  }, [isRunning, onTick]);

  const btnPadY = cl('6px', '0.8vh', '11px');
  const btnPadX = cl('10px', '1.3vw', '20px');
  const lowClock = timerSeconds <= 10;

  return (
    <div
      className="flex min-w-0 w-full shrink-0 flex-col overflow-hidden bg-white font-sans"
      style={{
        minWidth: cl('200px', '26vw', '360px'),
      }}
    >
      <div
        className="w-full text-center font-bold uppercase"
        style={{
          ...jerseyAccentSurfaceStyle(STAT_DASH.accentBlue),
          fontSize: cl('9px', '0.82vw', '12px'),
          letterSpacing: 2.5,
          paddingTop: '6px',
          paddingBottom: '6px',
        }}
      >
        {quarterLabel(quarter)}
      </div>
      <div
        className="flex w-full flex-1 items-center gap-[clamp(4px,0.5vw,8px)] bg-white"
        style={{
          padding: `${cl('5px', '0.7vh', '10px')} ${cl('6px', '0.8vw', '12px')}`,
        }}
      >
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            className="flex p-0 text-gray-700 hover:opacity-70"
            aria-label="Add one minute"
            onClick={() => onAdjustMinutes(60)}
          >
            <IoChevronUp size={chevronSize} />
          </button>
          <button
            type="button"
            className="flex p-0 text-gray-700 hover:opacity-70"
            aria-label="Subtract one minute"
            onClick={() => onAdjustMinutes(-60)}
          >
            <IoChevronDown size={chevronSize} />
          </button>
        </div>

        <span
          className={`min-w-0 flex-1 text-center tabular-nums leading-none ${lowClock ? 'text-red-600' : 'text-gray-900'}`}
          style={{
            fontFamily: GATEWAY_DISPLAY_FONT_STACK,
            fontSize: cl('24px', '3vw', '42px'),
            letterSpacing: 2,
          }}
          aria-live="polite"
        >
          {formatClock(timerSeconds)}
        </span>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            className="flex p-0 text-gray-700 hover:opacity-70"
            aria-label="Add one second"
            onClick={() => onAdjustSeconds(1)}
          >
            <IoChevronUp size={chevronSize} />
          </button>
          <button
            type="button"
            className="flex p-0 text-gray-700 hover:opacity-70"
            aria-label="Subtract one second"
            onClick={() => onAdjustSeconds(-1)}
          >
            <IoChevronDown size={chevronSize} />
          </button>
        </div>

        {showQuarterFinish && onQuarterFinish ? (
          <button
            type="button"
            onClick={onQuarterFinish}
            className="shrink-0 cursor-pointer whitespace-nowrap border-none font-bold uppercase hover:opacity-95"
            style={{
              background: FINISH_YELLOW,
              color: getContrastTextColor(FINISH_YELLOW),
              padding: `${btnPadY} ${btnPadX}`,
              fontSize: cl('12px', '1.25vw', '18px'),
              letterSpacing: 1,
            }}
          >
            Finish
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartStop}
            className="shrink-0 cursor-pointer whitespace-nowrap border-none font-bold uppercase hover:opacity-95"
            style={{
              background: isRunning ? STAT_DASH.startGreen : STAT_DASH.stopRed,
              color: getContrastTextColor(isRunning ? STAT_DASH.startGreen : STAT_DASH.stopRed),
              padding: `${btnPadY} ${btnPadX}`,
              fontSize: cl('12px', '1.25vw', '18px'),
              letterSpacing: 1,
            }}
          >
            {isRunning ? 'STOP' : 'START'}
          </button>
        )}
      </div>
    </div>
  );
};

export default GameTimer;
