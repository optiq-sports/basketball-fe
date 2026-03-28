import React, { useCallback, useState } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import MenuBar from './components/MenuBar';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import GameCenter from './components/GameCenter';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { STAT_DASH, STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from './statDashTheme';
import type { GameLogEntry, TeamSide } from './types';

const DEFAULT_HOME = 'TEAM 1';
const DEFAULT_AWAY = 'TEAM 2';
const QUARTER_DURATION_SEC = 10 * 60;
const DEFAULT_HOME_PLAYERS = [1, 2, 3, 4, 5];
const DEFAULT_AWAY_PLAYERS = [1, 2, 3, 4, 5];

const SEED_LOG: GameLogEntry[] = [
  {
    id: 'seed-1',
    period: 'Q1',
    clock: '09:22',
    team: 'Team 1',
    player: '#5 M. Abdul',
    action: 'shot',
    result: '3pt made',
  },
  {
    id: 'seed-2',
    period: 'Q1',
    clock: '09:22',
    team: 'Team 2',
    player: '#10 S. Langas',
    action: 'shot',
    result: '3pt made',
  },
  {
    id: 'seed-3',
    period: 'Q1',
    clock: '09:22',
    team: 'Team 2',
    player: '#10 S. Langas',
    action: 'shot',
    result: '3pt made',
  },
];

function newLogId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const StatDash: React.FC = () => {
  const { homeTeamColor, awayTeamColor } = useStatisticianTeamColors();
  const [homeName] = useState(DEFAULT_HOME);
  const [awayName] = useState(DEFAULT_AWAY);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [quarter] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(QUARTER_DURATION_SEC);
  const [isRunning, setIsRunning] = useState(false);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>(SEED_LOG);

  const clockLabel = formatClock(timerSeconds);
  const periodLabel = `Q${quarter}`;

  const appendLog = useCallback((row: Omit<GameLogEntry, 'id'>) => {
    setGameLog((prev) => [{ id: newLogId(), ...row }, ...prev]);
  }, []);

  const onTick = useCallback(() => {
    setTimerSeconds((s) => Math.max(0, s - 1));
  }, []);

  const onAdjustMinutes = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(QUARTER_DURATION_SEC, s + delta)));
  }, []);

  const onAdjustSeconds = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(QUARTER_DURATION_SEC, s + delta)));
  }, []);

  const onStartStop = useCallback(() => {
    setIsRunning((r) => !r);
  }, []);

  const onPlayerClick = useCallback(
    (side: TeamSide, jersey: number) => {
      const team = side === 'home' ? homeName : awayName;
      if (side === 'home') setHomeScore((s) => s + 2);
      else setAwayScore((s) => s + 2);
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team,
        player: `#${jersey}`,
        action: 'select',
        result: 'on court',
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const onFoul = useCallback(
    (side: TeamSide) => {
      const team = side === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team,
        player: '—',
        action: 'foul',
        result: 'personal',
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const onTurnover = useCallback(
    (side: TeamSide) => {
      const team = side === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team,
        player: '—',
        action: 'turnover',
        result: '—',
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const onTimeout = useCallback(() => {
    appendLog({
      period: periodLabel,
      clock: clockLabel,
      team: '—',
      player: '—',
      action: 'timeout',
      result: 'full',
    });
  }, [appendLog, clockLabel, periodLabel]);

  const onJumpBall = useCallback(() => {
    appendLog({
      period: periodLabel,
      clock: clockLabel,
      team: '—',
      player: '—',
      action: 'jump ball',
      result: 'possession',
    });
  }, [appendLog, clockLabel, periodLabel]);

  const onSub = useCallback(() => {
    appendLog({
      period: periodLabel,
      clock: clockLabel,
      team: '—',
      player: '—',
      action: 'substitution',
      result: '—',
    });
  }, [appendLog, clockLabel, periodLabel]);

  const chevronClass =
    'flex w-7 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]';

  return (
    <div
      className="flex min-h-[90dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <MenuBar />

      <div className="flex min-h-0 flex-1 items-stretch">
        <button type="button" className={chevronClass} aria-label="Previous panel" style={{ color: STAT_DASH.accentBlue }}>
          <IoChevronBack size={18} />
        </button>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4 sm:px-6">
          {/* Status column left of scoreboard tray (reference layout) */}
          <div className="flex min-w-0 shrink-0 items-center justify-evenly sm:gap-4">
            <StatusStrip />
            <div className="min-w-0 flex-1">
              <GameHeader
                homeName={homeName}
                awayName={awayName}
                homeScore={homeScore}
                awayScore={awayScore}
                homeColor={homeTeamColor}
                awayColor={awayTeamColor}
                quarter={quarter}
                timerSeconds={timerSeconds}
                isRunning={isRunning}
                onStartStop={onStartStop}
                onTick={onTick}
                onAdjustMinutes={onAdjustMinutes}
                onAdjustSeconds={onAdjustSeconds}
                onTimeout={onTimeout}
                onJumpBall={onJumpBall}
                onSub={onSub}
              />
            </div>
          </div>

          <GameCenter
            homeColor={homeTeamColor}
            awayColor={awayTeamColor}
            homePlayers={DEFAULT_HOME_PLAYERS}
            awayPlayers={DEFAULT_AWAY_PLAYERS}
            onPlayerClick={onPlayerClick}
            onFoul={onFoul}
            onTurnover={onTurnover}
          />

          <div className={`${STAT_DASH_MAIN_OUTER} shrink-0`}>
            <div
              className={`${STAT_DASH_MAIN_INNER} h-[min(220px,42dvh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:h-[min(141px,36dvh)]`}
            >
              {/* Header is fixed; only GameLog body scrolls — width matches GameCenter */}
              <GameLog entries={gameLog} />
            </div>
          </div>
        </div>

        <button type="button" className={chevronClass} aria-label="Next panel" style={{ color: STAT_DASH.accentBlue }}>
          <IoChevronForward size={18} />
        </button>
      </div>
    </div>
  );
};

export default StatDash;
