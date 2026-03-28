import React, { useCallback, useMemo, useRef, useState } from 'react';
import StatisticianFullscreenGate from '../../components/StatisticianFullscreenGate';
import MenuBar from './components/MenuBar';
import EdgeTeamDrawer from './components/EdgeTeamDrawer';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import GameCenter from './components/GameCenter';
import SubstitutionModal from './components/SubstitutionModal';
import TimeoutSelectModal, { type TimeoutChoice } from './components/TimeoutSelectModal';
import JumpBallModal, { type JumpBallChoice } from './components/JumpBallModal';
import type { CourtMarker } from './components/BasketballCourt';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { STAT_DASH, STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from './statDashTheme';
import type { GameLogEntry, TeamSide } from './types';
import type { ActiveShotFlow, ShotTypeId } from './shotRecordingUtils';
import { emptyShotDraft, getShotPoints, shotTypeResultPhrase } from './shotRecordingUtils';
import type {
  ActiveFoulFlow,
  FoulFlowDraft,
  FoulTypeId,
  PanelFoulPick,
} from './foulRecordingUtils';
import {
  foulFlowBack,
  foulTypeLabel,
  foulerLogPlayerField,
  initialFoulFlowFromCourt,
  initialFoulFlowFromPanelSelection,
  initialFoulFlowFromPlayer,
  isFoulerDraftComplete,
  opponentOf,
} from './foulRecordingUtils';
import { isCourtClickThreePointer } from './courtThreePoint';
import type {
  ActiveTurnoverFlow,
  TurnoverFlowDraft,
  TurnoverTypeId,
} from './turnoverRecordingUtils';
import {
  initialTurnoverFlowFromPanel,
  turnoverFlowBack,
  turnoverTypeLabel,
} from './turnoverRecordingUtils';
import type { TeamLineup } from './substitutionLineupUtils';
import {
  cloneLineup,
  compactOnCourt,
  DEFAULT_TEAM_LINEUP,
  diffLineupOnCourt,
  formatSubstitutionDiff,
  lineupIsComplete,
} from './substitutionLineupUtils';

const DEFAULT_HOME = 'TEAM 1';
const DEFAULT_AWAY = 'TEAM 2';
const QUARTER_DURATION_SEC = 10 * 60;

type ShotFlowState = 'idle' | ActiveShotFlow;
type FoulFlowState = 'idle' | ActiveFoulFlow;
type TurnoverFlowState = 'idle' | ActiveTurnoverFlow;

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

  const [turnoverFlow, setTurnoverFlow] = useState<TurnoverFlowState>('idle');
  const turnoverFlowRef = useRef<TurnoverFlowState>('idle');
  turnoverFlowRef.current = turnoverFlow;

  const [timeoutModalOpen, setTimeoutModalOpen] = useState(false);
  const timeoutModalOpenRef = useRef(false);
  timeoutModalOpenRef.current = timeoutModalOpen;

  const [jumpBallModalOpen, setJumpBallModalOpen] = useState(false);
  const jumpBallModalOpenRef = useRef(false);
  jumpBallModalOpenRef.current = jumpBallModalOpen;

  const [homeLineup, setHomeLineup] = useState<TeamLineup>(() => cloneLineup(DEFAULT_TEAM_LINEUP));
  const [awayLineup, setAwayLineup] = useState<TeamLineup>(() => cloneLineup(DEFAULT_TEAM_LINEUP));

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subDraftHome, setSubDraftHome] = useState<TeamLineup>(() => cloneLineup(DEFAULT_TEAM_LINEUP));
  const [subDraftAway, setSubDraftAway] = useState<TeamLineup>(() => cloneLineup(DEFAULT_TEAM_LINEUP));
  const subModalOpenRef = useRef(false);
  subModalOpenRef.current = subModalOpen;

  const [foulPickerOpen, setFoulPickerOpen] = useState(false);
  const foulPickerOpenRef = useRef(false);
  foulPickerOpenRef.current = foulPickerOpen;

  const homeActiveList = useMemo(() => compactOnCourt(homeLineup), [homeLineup]);
  const awayActiveList = useMemo(() => compactOnCourt(awayLineup), [awayLineup]);
  const activeRosterRef = useRef<{ home: number[]; away: number[] }>({
    home: compactOnCourt(cloneLineup(DEFAULT_TEAM_LINEUP)),
    away: compactOnCourt(cloneLineup(DEFAULT_TEAM_LINEUP)),
  });
  activeRosterRef.current = { home: homeActiveList, away: awayActiveList };

  const pendingCourtClickRef = useRef<{ nx: number; ny: number } | null>(null);
  const [courtShotMarkers, setCourtShotMarkers] = useState<CourtMarker[]>([]);
  const [courtFoulMarkers, setCourtFoulMarkers] = useState<CourtMarker[]>([]);

  const captureCourtPoint = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    pendingCourtClickRef.current = {
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height,
    };
  }, []);

  const clearPendingCourtPoint = useCallback(() => {
    pendingCourtClickRef.current = null;
  }, []);

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
        !isFoulerDraftComplete(draft) ||
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
        player: foulerLogPlayerField(draft),
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} #${draft.fouledJersey}; No FT`,
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const commitFoulWithFtSequence = useCallback(
    (draft: FoulFlowDraft, opts?: { skipRebound?: boolean }) => {
      const skipRebound = opts?.skipRebound === true;
      if (
        !isFoulerDraftComplete(draft) ||
        draft.foulType === null ||
        draft.fouledJersey === null ||
        draft.ftCount === null ||
        draft.ftCount < 1
      ) {
        return;
      }
      if (
        !skipRebound &&
        (draft.reboundSide === null || draft.reboundJersey === null)
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
      let rebSuffix = '';
      if (
        !skipRebound &&
        draft.reboundSide !== null &&
        draft.reboundJersey !== null
      ) {
        const rebTeamName =
          draft.reboundSide === 'home' ? homeName : awayName;
        rebSuffix = `; Reb ${rebTeamName} #${draft.reboundJersey}`;
      }
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: foulerLogPlayerField(draft),
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} #${draft.fouledJersey}; FTs: ${ftStr}${rebSuffix}`,
      });
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const openShotFlowFromPlayer = useCallback((side: TeamSide, jersey: number) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    pendingCourtClickRef.current = null;
    setFoulFlow('idle');
    setTurnoverFlow('idle');
    setShotFlow({
      entry: 'player',
      step: 'shotType',
      draft: { side, shooterJersey: jersey, shotType: null, fastBreak: false },
    });
  }, []);

  const openShotFlowFromCourt = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    captureCourtPoint(e);
    setFoulFlow('idle');
    setTurnoverFlow('idle');
    setShotFlow({
      entry: 'court',
      step: 'pickShooter',
      draft: emptyShotDraft(),
    });
  }, [captureCourtPoint]);

  const openFoulFlowFromCourt = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    captureCourtPoint(e);
    setShotFlow('idle');
    setTurnoverFlow('idle');
    setFoulFlow(initialFoulFlowFromCourt());
  }, [captureCourtPoint]);

  const openFoulFlowFromPlayer = useCallback((side: TeamSide, jersey: number) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    pendingCourtClickRef.current = null;
    setShotFlow('idle');
    setTurnoverFlow('idle');
    setFoulFlow(initialFoulFlowFromPlayer(side, jersey));
  }, []);

  /** FOUL strip button: picker modal (player / bench / coach), then foul wizard. */
  const openFoulFlowFromPanelFoulButton = useCallback((_side: TeamSide) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    pendingCourtClickRef.current = null;
    setShotFlow('idle');
    setTurnoverFlow('idle');
    setFoulFlow('idle');
    setFoulPickerOpen(true);
  }, []);

  const handleFoulPanelPickerSelect = useCallback((side: TeamSide, pick: PanelFoulPick) => {
    setFoulPickerOpen(false);
    setFoulFlow(initialFoulFlowFromPanelSelection(side, pick));
  }, []);

  const handleFoulPanelPickerCancel = useCallback(() => {
    setFoulPickerOpen(false);
  }, []);

  const openTurnoverFlowFromPanel = useCallback((side: TeamSide) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    pendingCourtClickRef.current = null;
    setShotFlow('idle');
    setFoulFlow('idle');
    setTurnoverFlow(initialTurnoverFlowFromPanel(side));
  }, []);

  const handleFoulFlowBack = useCallback(() => {
    setFoulFlow((cur) => {
      if (cur === 'idle') return cur;
      const next = foulFlowBack(cur);
      return next === 'idle' ? 'idle' : next;
    });
  }, []);

  const handleFoulFlowCancel = useCallback(() => {
    clearPendingCourtPoint();
    setFoulFlow('idle');
    setFoulPickerOpen(false);
  }, [clearPendingCourtPoint]);

  const handleFoulPickFouler = useCallback((side: TeamSide, jersey: number) => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickFouler') return cur;
      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return cur;
      return {
        ...cur,
        step: 'foulType',
        draft: { ...cur.draft, foulerSide: side, foulerJersey: jersey, foulerRole: 'player' },
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
      const { foulerSide } = cur.draft;
      if (foulerSide === null) return cur;
      const fouledSide = opponentOf(foulerSide);
      const active = fouledSide === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return cur;
      return { ...cur, step: 'ftCount', draft: { ...cur.draft, fouledJersey: jersey } };
    });
  }, []);

  const handleFoulSelectFtCount = useCallback(
    (count: 0 | 1 | 2 | 3) => {
      const cur = foulFlowRef.current;
      if (cur === 'idle' || cur.step !== 'ftCount') return;
      const { draft } = cur;
      if (
        !isFoulerDraftComplete(draft) ||
        draft.foulType === null ||
        draft.fouledJersey === null
      ) {
        return;
      }
      if (count === 0) {
        commitFoulNoFt(draft);
        if (cur.entry === 'court') {
          const pt = pendingCourtClickRef.current;
          if (pt && draft.foulerSide !== null) {
            const foulColor = draft.foulerSide === 'home' ? homeTeamColor : awayTeamColor;
            setCourtFoulMarkers((prev) => [...prev, { ...pt, color: foulColor }]);
            pendingCourtClickRef.current = null;
          }
        } else {
          pendingCourtClickRef.current = null;
        }
        setFoulFlow('idle');
        return;
      }
      setFoulFlow({
        ...cur,
        step: 'ftShooter',
        draft: { ...draft, ftCount: count, ftResults: [] },
      });
    },
    [commitFoulNoFt, homeTeamColor, awayTeamColor]
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

  const handleFoulFtResult = useCallback(
    (result: 'made' | 'miss') => {
      const cur = foulFlowRef.current;
      if (cur === 'idle' || cur.step !== 'ftResults') return;
      const { draft } = cur;
      const n = draft.ftCount;
      if (n === null || n < 1) return;
      const idx = draft.ftResults.length;
      if (idx >= n) return;
      const nextResults = [...draft.ftResults, result];
      if (nextResults.length < n) {
        setFoulFlow({
          ...cur,
          draft: { ...draft, ftResults: nextResults },
        });
        return;
      }
      const allMade = nextResults.every((r) => r === 'made');
      if (allMade) {
        const finished = { ...draft, ftResults: nextResults };
        const fromCourt = cur.entry === 'court';
        commitFoulWithFtSequence(finished, { skipRebound: true });
        if (fromCourt) {
          const pt = pendingCourtClickRef.current;
          if (pt && finished.foulerSide !== null) {
            const foulColor =
              finished.foulerSide === 'home' ? homeTeamColor : awayTeamColor;
            setCourtFoulMarkers((prev) => [...prev, { ...pt, color: foulColor }]);
            pendingCourtClickRef.current = null;
          }
        } else {
          pendingCourtClickRef.current = null;
        }
        setFoulFlow('idle');
        return;
      }
      setFoulFlow({
        ...cur,
        step: 'rebounder',
        draft: { ...draft, ftResults: nextResults },
      });
    },
    [commitFoulWithFtSequence, homeTeamColor, awayTeamColor]
  );

  const handleFoulPickRebounder = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = foulFlowRef.current;
      if (cur === 'idle' || cur.step !== 'rebounder') return;
      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;
      const draft = { ...cur.draft, reboundSide: side, reboundJersey: jersey };
      const fromCourt = cur.entry === 'court';
      commitFoulWithFtSequence(draft);
      if (fromCourt) {
        const pt = pendingCourtClickRef.current;
        if (pt && draft.foulerSide !== null) {
          const foulColor = draft.foulerSide === 'home' ? homeTeamColor : awayTeamColor;
          setCourtFoulMarkers((prev) => [...prev, { ...pt, color: foulColor }]);
          pendingCourtClickRef.current = null;
        }
      } else {
        pendingCourtClickRef.current = null;
      }
      setFoulFlow('idle');
    },
    [commitFoulWithFtSequence, homeTeamColor, awayTeamColor]
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

  const handleModalCancel = useCallback(() => {
    clearPendingCourtPoint();
    setShotFlow('idle');
  }, [clearPendingCourtPoint]);

  const handlePickShooter = useCallback((side: TeamSide, jersey: number) => {
    setShotFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickShooter') return cur;
      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return cur;
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
      if (assist !== 'none' && assist === draft.shooterJersey) return;
      if (assist !== 'none') {
        const active = draft.side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
        if (!active.includes(assist)) return;
      }


      const teamName = draft.side === 'home' ? homeName : awayName;
      const pt = pendingCourtClickRef.current;
      const isThreeFromCourt =
        cur.entry === 'court' &&
        pt !== null &&
        draft.side !== null &&
        isCourtClickThreePointer(pt.nx, pt.ny, draft.side);
      const points = isThreeFromCourt ? 3 : getShotPoints(draft.shotType);
      if (draft.side === 'home') setHomeScore((s) => s + points);
      else setAwayScore((s) => s + points);

      const parts = [
        isThreeFromCourt ? '3pt made' : shotTypeResultPhrase(draft.shotType),
      ];
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

      if (cur.entry === 'court') {
        const clickPt = pendingCourtClickRef.current;
        if (clickPt && draft.side !== null) {
          const shotColor = draft.side === 'home' ? homeTeamColor : awayTeamColor;
          setCourtShotMarkers((prev) => [...prev, { ...clickPt, color: shotColor }]);
          pendingCourtClickRef.current = null;
        }
      } else {
        pendingCourtClickRef.current = null;
      }

      setShotFlow('idle');
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName, homeTeamColor, awayTeamColor]
  );

  const commitTurnoverLog = useCallback(
    (draft: TurnoverFlowDraft, steal: { side: TeamSide; jersey: number } | null) => {
      if (draft.committingJersey === null || draft.turnoverType === null) return;
      const committingTeam = draft.committingSide === 'home' ? homeName : awayName;
      const typeLabel = turnoverTypeLabel(draft.turnoverType);
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: committingTeam,
        player: `#${draft.committingJersey}`,
        action: 'turnover',
        result: typeLabel,
      });
      if (steal !== null) {
        const stealTeam = steal.side === 'home' ? homeName : awayName;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: stealTeam,
          player: `#${steal.jersey}`,
          action: 'steal',
          result: `Off #${draft.committingJersey} turnover`,
        });
      }
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const handleTurnoverFlowBack = useCallback(() => {
    setTurnoverFlow((cur) => {
      if (cur === 'idle') return cur;
      const next = turnoverFlowBack(cur);
      return next === 'idle' ? 'idle' : next;
    });
  }, []);

  const handleTurnoverFlowCancel = useCallback(() => {
    setTurnoverFlow('idle');
  }, []);

  const handleTurnoverPickCommittingPlayer = useCallback((jersey: number) => {
    setTurnoverFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'pickPlayer') return cur;
      const { committingSide } = cur.draft;
      const active = committingSide === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return cur;
      return {
        ...cur,
        step: 'turnoverType',
        draft: { ...cur.draft, committingJersey: jersey },
      };
    });
  }, []);

  const handleTurnoverSelectType = useCallback((type: TurnoverTypeId) => {
    setTurnoverFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'turnoverType') return cur;
      return {
        ...cur,
        step: 'steal',
        draft: { ...cur.draft, turnoverType: type },
      };
    });
  }, []);

  const handleTurnoverNoSteal = useCallback(() => {
    const cur = turnoverFlowRef.current;
    if (cur === 'idle' || cur.step !== 'steal') return;
    commitTurnoverLog(cur.draft, null);
    setTurnoverFlow('idle');
  }, [commitTurnoverLog]);

  const handleTurnoverPickStealer = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = turnoverFlowRef.current;
      if (cur === 'idle' || cur.step !== 'steal') return;
      const { draft } = cur;
      if (side !== opponentOf(draft.committingSide)) return;
      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;
      commitTurnoverLog(draft, { side, jersey });
      setTurnoverFlow('idle');
    },
    [commitTurnoverLog]
  );

  const openTimeoutModal = useCallback(() => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    setTimeoutModalOpen(true);
  }, []);

  const openJumpBallModal = useCallback(() => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    setJumpBallModalOpen(true);
  }, []);

  const openSubstitutionModal = useCallback(() => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== 'idle' ||
      foulFlowRef.current !== 'idle' ||
      turnoverFlowRef.current !== 'idle'
    )
      return;
    setSubDraftHome(cloneLineup(homeLineup));
    setSubDraftAway(cloneLineup(awayLineup));
    setSubModalOpen(true);
  }, [homeLineup, awayLineup]);

  const handleSubstitutionFinish = useCallback(() => {
    if (!lineupIsComplete(subDraftHome) || !lineupIsComplete(subDraftAway)) return;
    const homeDiff = diffLineupOnCourt(homeLineup, subDraftHome);
    const awayDiff = diffLineupOnCourt(awayLineup, subDraftAway);
    appendLog({
      period: periodLabel,
      clock: clockLabel,
      team: '—',
      player: '—',
      action: 'substitution',
      result: `${formatSubstitutionDiff(homeName, homeDiff)} · ${formatSubstitutionDiff(awayName, awayDiff)}`,
    });
    setHomeLineup(cloneLineup(subDraftHome));
    setAwayLineup(cloneLineup(subDraftAway));
    setSubModalOpen(false);
  }, [
    subDraftHome,
    subDraftAway,
    homeLineup,
    awayLineup,
    appendLog,
    clockLabel,
    periodLabel,
    homeName,
    awayName,
  ]);

  const handleSubstitutionCancel = useCallback(() => {
    setSubModalOpen(false);
  }, []);

  const handleTimeoutSelect = useCallback(
    (choice: TimeoutChoice) => {
      if (choice === 'home') {
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: homeName,
          player: '—',
          action: 'timeout',
          result: 'full',
        });
      } else if (choice === 'away') {
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: awayName,
          player: '—',
          action: 'timeout',
          result: 'full',
        });
      } else {
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: 'Officials',
          player: '—',
          action: 'timeout',
          result: 'official / media',
        });
      }
      setTimeoutModalOpen(false);
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const handleTimeoutModalCancel = useCallback(() => {
    setTimeoutModalOpen(false);
  }, []);

  const handleJumpBallSelect = useCallback(
    (choice: JumpBallChoice) => {
      const teamName = choice === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: '—',
        action: 'jump ball',
        result: 'possession',
      });
      setJumpBallModalOpen(false);
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const handleJumpBallCancel = useCallback(() => {
    setJumpBallModalOpen(false);
  }, []);

  return (
    <div
      className="relative flex min-h-[90dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <StatisticianFullscreenGate />
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
                onTimeout={openTimeoutModal}
                onJumpBall={openJumpBallModal}
                onSub={openSubstitutionModal}
              />
            </div>
          </div>

          <GameCenter
            homeColor={homeTeamColor}
            awayColor={awayTeamColor}
            homeActivePlayers={homeActiveList}
            awayActivePlayers={awayActiveList}
            onPlayerFoulClick={openFoulFlowFromPlayer}
            onPlayerShotContextMenu={(side, jersey) => openShotFlowFromPlayer(side, jersey)}
            onFoul={openFoulFlowFromPanelFoulButton}
            onTurnover={openTurnoverFlowFromPanel}
            onCourtFoulClick={openFoulFlowFromCourt}
            onCourtShotContextMenu={(e) => openShotFlowFromCourt(e)}
            shotFlow={shotFlow}
            foulFlow={foulFlow}
            turnoverFlow={turnoverFlow}
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
            onTurnoverFlowBack={handleTurnoverFlowBack}
            onTurnoverFlowCancel={handleTurnoverFlowCancel}
            onTurnoverPickCommittingPlayer={handleTurnoverPickCommittingPlayer}
            onTurnoverSelectType={handleTurnoverSelectType}
            onTurnoverNoSteal={handleTurnoverNoSteal}
            onTurnoverPickStealer={handleTurnoverPickStealer}
            courtShotMarkers={courtShotMarkers}
            courtFoulMarkers={courtFoulMarkers}
            foulPickerOpen={foulPickerOpen}
            homeBench={homeLineup.bench}
            awayBench={awayLineup.bench}
            onFoulPanelPick={handleFoulPanelPickerSelect}
            onFoulPanelCancel={handleFoulPanelPickerCancel}
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

      <TimeoutSelectModal
        open={timeoutModalOpen}
        homeName={homeName}
        awayName={awayName}
        homeColor={homeTeamColor}
        awayColor={awayTeamColor}
        onSelect={handleTimeoutSelect}
        onCancel={handleTimeoutModalCancel}
      />

      <JumpBallModal
        open={jumpBallModalOpen}
        homeName={homeName}
        awayName={awayName}
        homeColor={homeTeamColor}
        awayColor={awayTeamColor}
        onSelect={handleJumpBallSelect}
        onCancel={handleJumpBallCancel}
      />

      <SubstitutionModal
        open={subModalOpen}
        homeName={homeName}
        awayName={awayName}
        homeColor={homeTeamColor}
        awayColor={awayTeamColor}
        draftHome={subDraftHome}
        draftAway={subDraftAway}
        onChangeHome={setSubDraftHome}
        onChangeAway={setSubDraftAway}
        onFinish={handleSubstitutionFinish}
        onCancel={handleSubstitutionCancel}
      />
    </div>
  );
};

export default StatDash;
