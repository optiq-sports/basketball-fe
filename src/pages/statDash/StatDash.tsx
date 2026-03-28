import React, { useCallback, useRef, useState } from 'react';
import MenuBar from './components/MenuBar';
import EdgeTeamDrawer from './components/EdgeTeamDrawer';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import GameCenter from './components/GameCenter';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { STAT_DASH, STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from './statDashTheme';
import type { GameLogEntry, TeamSide } from './types';
import type { ActiveShotFlow, ShotTypeId } from './shotRecordingUtils';
import { emptyShotDraft, getShotPoints, shotTypeResultPhrase } from './shotRecordingUtils';
import type { ActiveFoulFlow, FoulFlowDraft, FoulTypeId } from './foulRecordingUtils';
import {
  foulFlowBack,
  foulTypeLabel,
  initialFoulFlowFromCourt,
  initialFoulFlowFromPlayer,
  opponentOf,
} from './foulRecordingUtils';

const DEFAULT_HOME = 'TEAM 1';
const DEFAULT_AWAY = 'TEAM 2';
const QUARTER_DURATION_SEC = 10 * 60;
const DEFAULT_HOME_PLAYERS = [1, 2, 3, 4, 5];
const DEFAULT_AWAY_PLAYERS = [1, 2, 3, 4, 5];

type ShotFlowState = 'idle' | ActiveShotFlow;
type FoulFlowState = 'idle' | ActiveFoulFlow;

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
  const [shotFlow, setShotFlow] = useState<ShotFlowState>('idle');
  const shotFlowRef = useRef<ShotFlowState>('idle');
  shotFlowRef.current = shotFlow;

  const [foulFlow, setFoulFlow] = useState<FoulFlowState>('idle');
  const foulFlowRef = useRef<FoulFlowState>('idle');
  foulFlowRef.current = foulFlow;

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

  const commitFoulNoFt = useCallback(
    (draft: FoulFlowDraft) => {
      if (
        draft.foulerSide === null ||
        draft.foulerJersey === null ||
        draft.foulType === null ||
        draft.fouledJersey === null
      ) {
        return;
      }
      const foulerTeamName = draft.foulerSide === 'home' ? homeName : awayName;
      const fouledSide = opponentOf(draft.foulerSide);
      const fouledTeamName = fouledSide === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: `#${draft.foulerJersey}`,
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} #${draft.fouledJersey}; No FT`,
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const commitFoulWithFtSequence = useCallback(
    (draft: FoulFlowDraft) => {
      if (
        draft.foulerSide === null ||
        draft.foulerJersey === null ||
        draft.foulType === null ||
        draft.fouledJersey === null ||
        draft.reboundSide === null ||
        draft.reboundJersey === null ||
        draft.ftCount === null ||
        draft.ftCount < 1
      ) {
        return;
      }
      const foulerTeamName = draft.foulerSide === 'home' ? homeName : awayName;
      const fouledSide = opponentOf(draft.foulerSide);
      const fouledTeamName = fouledSide === 'home' ? homeName : awayName;
      const makes = draft.ftResults.filter((r) => r === 'made').length;
      if (fouledSide === 'home') setHomeScore((s) => s + makes);
      else setAwayScore((s) => s + makes);
      const ftStr = draft.ftResults.map((r) => (r === 'made' ? 'Made' : 'Miss')).join(', ');
      const rebTeamName = draft.reboundSide === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: `#${draft.foulerJersey}`,
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} #${draft.fouledJersey}; FTs: ${ftStr}; Reb ${rebTeamName} #${draft.reboundJersey}`,
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const openShotFlowFromPlayer = useCallback((side: TeamSide, jersey: number) => {
    setFoulFlow('idle');
    setShotFlow({
      entry: 'player',
      step: 'shotType',
      draft: { side, shooterJersey: jersey, shotType: null, fastBreak: false },
    });
  }, []);

  const openShotFlowFromCourt = useCallback(() => {
    setFoulFlow('idle');
    setShotFlow({
      entry: 'court',
      step: 'pickShooter',
      draft: emptyShotDraft(),
    });
  }, []);

  const openFoulFlowFromCourt = useCallback(() => {
    setShotFlow('idle');
    setFoulFlow(initialFoulFlowFromCourt());
  }, []);

  const openFoulFlowFromPlayer = useCallback((side: TeamSide, jersey: number) => {
    setShotFlow('idle');
    setFoulFlow(initialFoulFlowFromPlayer(side, jersey));
  }, []);

  const handleFoulFlowBack = useCallback(() => {
    setFoulFlow((cur) => {
      if (cur === 'idle') return cur;
      const next = foulFlowBack(cur);
      return next === 'idle' ? 'idle' : next;
    });
  }, []);

  const handleFoulFlowCancel = useCallback(() => setFoulFlow('idle'), []);

  const handleFoulPickFouler = useCallback((side: TeamSide, jersey: number) => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickFouler') return cur;
      return {
        ...cur,
        step: 'foulType',
        draft: { ...cur.draft, foulerSide: side, foulerJersey: jersey },
      };
    });
  }, []);

  const handleFoulSelectType = useCallback((foulType: FoulTypeId) => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'foulType') return cur;
      return { ...cur, step: 'pickFouled', draft: { ...cur.draft, foulType } };
    });
  }, []);

  const handleFoulPickFouled = useCallback((jersey: number) => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickFouled') return cur;
      return { ...cur, step: 'ftCount', draft: { ...cur.draft, fouledJersey: jersey } };
    });
  }, []);

  const handleFoulSelectFtCount = useCallback(
    (count: 0 | 1 | 2 | 3) => {
      const cur = foulFlowRef.current;
      if (cur === 'idle' || cur.step !== 'ftCount') return;
      const { draft } = cur;
      if (
        draft.foulerSide === null ||
        draft.foulerJersey === null ||
        draft.foulType === null ||
        draft.fouledJersey === null
      ) {
        return;
      }
      if (count === 0) {
        commitFoulNoFt(draft);
        setFoulFlow('idle');
        return;
      }
      setFoulFlow({
        ...cur,
        step: 'ftShooter',
        draft: { ...draft, ftCount: count, ftResults: [] },
      });
    },
    [commitFoulNoFt]
  );

  const handleFoulFtShooterSame = useCallback(() => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'ftShooter') return cur;
      const n = cur.draft.ftCount;
      if (n === null || n < 1) return cur;
      return {
        ...cur,
        step: 'ftResults',
        draft: { ...cur.draft, shooterSameAsFouled: true },
      };
    });
  }, []);

  const handleFoulFtResult = useCallback((result: 'made' | 'miss') => {
    const cur = foulFlowRef.current;
    if (cur === 'idle' || cur.step !== 'ftResults') return;
    const { draft } = cur;
    const n = draft.ftCount;
    if (n === null || n < 1) return;
    const idx = draft.ftResults.length;
    if (idx >= n) return;
    const nextResults = [...draft.ftResults, result];
    if (nextResults.length >= n) {
      setFoulFlow({
        ...cur,
        step: 'rebounder',
        draft: { ...draft, ftResults: nextResults },
      });
    } else {
      setFoulFlow({
        ...cur,
        draft: { ...draft, ftResults: nextResults },
      });
    }
  }, []);

  const handleFoulPickRebounder = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = foulFlowRef.current;
      if (cur === 'idle' || cur.step !== 'rebounder') return;
      const draft = { ...cur.draft, reboundSide: side, reboundJersey: jersey };
      commitFoulWithFtSequence(draft);
      setFoulFlow('idle');
    },
    [commitFoulWithFtSequence]
  );

  const handleModalBack = useCallback(() => {
    setShotFlow((cur) => {
      if (cur === 'idle') return cur;
      if (cur.step === 'assist') {
        return { ...cur, step: 'shotType', draft: { ...cur.draft, shotType: null } };
      }
      if (cur.step === 'shotType') {
        if (cur.entry === 'court') {
          return { ...cur, step: 'pickShooter', draft: emptyShotDraft() };
        }
        return 'idle';
      }
      return cur;
    });
  }, []);

  const handleModalCancel = useCallback(() => setShotFlow('idle'), []);

  const handlePickShooter = useCallback((side: TeamSide, jersey: number) => {
    setShotFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickShooter') return cur;
      return {
        ...cur,
        step: 'shotType',
        draft: { ...cur.draft, side, shooterJersey: jersey },
      };
    });
  }, []);

  const handleSelectShotType = useCallback((shotType: ShotTypeId) => {
    setShotFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'shotType') return cur;
      return {
        ...cur,
        step: 'assist',
        draft: { ...cur.draft, shotType },
      };
    });
  }, []);

  const handleSetFastBreak = useCallback((fastBreak: boolean) => {
    setShotFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'shotType') return cur;
      return { ...cur, draft: { ...cur.draft, fastBreak } };
    });
  }, []);

  const handleSelectAssist = useCallback(
    (assist: number | 'none') => {
      const cur = shotFlowRef.current;
      if (cur === 'idle' || cur.step !== 'assist') return;
      const { draft } = cur;
      if (draft.side === null || draft.shooterJersey === null || draft.shotType === null) return;

      const teamName = draft.side === 'home' ? homeName : awayName;
      const points = getShotPoints(draft.shotType);
      if (draft.side === 'home') setHomeScore((s) => s + points);
      else setAwayScore((s) => s + points);

      const parts = [shotTypeResultPhrase(draft.shotType)];
      if (draft.fastBreak) parts.push('Fast break');
      if (assist === 'none') parts.push('No assist');
      else parts.push(`Assist #${assist}`);

      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: `#${draft.shooterJersey}`,
        action: 'shot',
        result: parts.join(' · '),
      });

      setShotFlow('idle');
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
      className="relative flex min-h-[90dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <MenuBar />

      <EdgeTeamDrawer edge="left" teamName={homeName} />
      <EdgeTeamDrawer edge="right" teamName={awayName} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden py-4 pl-12 pr-12 sm:pl-14 sm:pr-14">
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
            onPlayerFoulClick={openFoulFlowFromPlayer}
            onPlayerShotContextMenu={(side, jersey) => openShotFlowFromPlayer(side, jersey)}
            onFoul={onFoul}
            onTurnover={onTurnover}
            onCourtFoulClick={openFoulFlowFromCourt}
            onCourtShotContextMenu={() => openShotFlowFromCourt()}
            shotFlow={shotFlow}
            foulFlow={foulFlow}
            homeName={homeName}
            awayName={awayName}
            onShotFlowBack={handleModalBack}
            onShotFlowCancel={handleModalCancel}
            onPickShooter={handlePickShooter}
            onSelectShotType={handleSelectShotType}
            onSetFastBreak={handleSetFastBreak}
            onSelectAssist={handleSelectAssist}
            onFoulFlowBack={handleFoulFlowBack}
            onFoulFlowCancel={handleFoulFlowCancel}
            onFoulPickFouler={handleFoulPickFouler}
            onFoulSelectType={handleFoulSelectType}
            onFoulPickFouled={handleFoulPickFouled}
            onFoulSelectFtCount={handleFoulSelectFtCount}
            onFoulFtShooterSame={handleFoulFtShooterSame}
            onFoulFtResult={handleFoulFtResult}
            onFoulPickRebounder={handleFoulPickRebounder}
          />

          <div className={`${STAT_DASH_MAIN_OUTER} shrink-0`}>
            <div
              className={`${STAT_DASH_MAIN_INNER} h-[min(220px,42dvh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:h-[min(141px,36dvh)]`}
            >
              <GameLog entries={gameLog} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatDash;
