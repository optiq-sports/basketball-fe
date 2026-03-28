import React, { useCallback, useMemo, useState } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import MenuBar from './components/MenuBar';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import ActionButtons from './components/ActionButtons';
import GameCenter from './components/GameCenter';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import type { GameLogEntry, TeamSide } from './types';

const DEFAULT_HOME = 'TEAM 1';
const DEFAULT_AWAY = 'TEAM 2';
const HOME_COLOR = '#cc2222';
const AWAY_COLOR = '#c8a000';
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
    period: '',
    clock: '',
    team: '',
    player: '#5 I. Maina',
    action: '',
    result: '',
  },
  {
    id: 'seed-3',
    period: '',
    clock: '',
    team: 'Team 2',
    player: '#10 S. Langas',
    action: 'rebound',
    result: 'DF rebound',
  },
];

function newLogId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const StatDash: React.FC = () => {
  const matchKeyLabel = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('statistician_match_key')?.trim() ?? '';
  }, []);

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
    setGameLog((prev) => [...prev, { id: newLogId(), ...row }]);
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

  return (
    <div
      className="flex min-h-[100dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#c8c8c8' }}
    >
      <MenuBar />
      {matchKeyLabel ? (
        <p className="truncate border-b border-black/10 bg-black/5 px-3 py-0.5 text-[10px] text-gray-600">
          Match key: <span className="font-mono text-gray-800">{matchKeyLabel}</span>
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 items-stretch">
        <button
          type="button"
          className="flex w-7 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#2563eb] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Previous panel"
        >
          <IoChevronBack size={18} />
        </button>

        <StatusStrip />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 py-2.5 pr-2.5 pl-0">
          <GameHeader
            homeName={homeName}
            awayName={awayName}
            homeScore={homeScore}
            awayScore={awayScore}
            homeColor={HOME_COLOR}
            awayColor={AWAY_COLOR}
            quarter={quarter}
            timerSeconds={timerSeconds}
            isRunning={isRunning}
            onStartStop={onStartStop}
            onTick={onTick}
            onAdjustMinutes={onAdjustMinutes}
            onAdjustSeconds={onAdjustSeconds}
          />

          <ActionButtons onTimeout={onTimeout} onJumpBall={onJumpBall} onSub={onSub} />

          <GameCenter
            homeColor={HOME_COLOR}
            awayColor={AWAY_COLOR}
            homePlayers={DEFAULT_HOME_PLAYERS}
            awayPlayers={DEFAULT_AWAY_PLAYERS}
            onPlayerClick={onPlayerClick}
            onFoul={onFoul}
            onTurnover={onTurnover}
          />

          <div className="min-h-0 shrink-0 overflow-auto">
            <GameLog entries={gameLog} />
          </div>
        </div>

        <button
          type="button"
          className="flex w-7 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-[#2563eb] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Next panel"
        >
          <IoChevronForward size={18} />
        </button>
      </div>
    </div>
  );
};

export default StatDash;
