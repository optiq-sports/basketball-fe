import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StatisticianFullscreenGate from '../../components/StatisticianFullscreenGate';
import MenuBar from './components/MenuBar';
import EdgeTeamDrawer from './components/EdgeTeamDrawer';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import GameCenter from './components/GameCenter';
import SubstitutionModal from './components/SubstitutionModal';
import SwitchSidesModal from './components/SwitchSidesModal';
import { type TimeoutChoice } from './components/TimeoutSelectModal';
import type { JumpBallChoice } from './components/JumpBallModal';
import type { CourtMarker } from './components/BasketballCourt';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { STAT_DASH, STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from './statDashTheme';
import type { GameLogEntry, TeamSide } from './types';
import type { ActiveShotFlow, ReboundOutcomeId, ShotTypeId } from './shotRecordingUtils';
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
  initialFoulFlowFromPanelSelection,
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
  fullRoster,
  lineupIsComplete,
} from './substitutionLineupUtils';
import { readGameSetupOrientation } from '../gameSetupOrientation';
import { clearJumpBallWinner, readJumpBallWinner } from '../jumpBallWinner';

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
  const initialOrientation = useMemo(() => readGameSetupOrientation(), []);
  const [homeOnLeft, setHomeOnLeft] = useState(initialOrientation.homeOnLeft);
  const [homeAttacksLeft, setHomeAttacksLeft] = useState(initialOrientation.homeAttacksLeft);
  const { homeTeamColor, awayTeamColor } = useStatisticianTeamColors();
  const [homeName] = useState(DEFAULT_HOME);
  const [awayName] = useState(DEFAULT_AWAY);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [quarter, setQuarter] = useState(1);
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
  const [activeDrawer, setActiveDrawer] = useState<'left' | 'right' | null>(null);
  const [quarterBreakModalOpen, setQuarterBreakModalOpen] = useState(false);
  const [quarterBreakPending, setQuarterBreakPending] = useState(false);
  const [editingLog, setEditingLog] = useState<GameLogEntry | null>(null);
  const [switchSidesOpen, setSwitchSidesOpen] = useState(false);

  const homeActiveList = useMemo(() => compactOnCourt(homeLineup), [homeLineup]);
  const awayActiveList = useMemo(() => compactOnCourt(awayLineup), [awayLineup]);

  const homePanelNumbers = useMemo(() => {
    if (foulFlow !== 'idle' && foulFlow.step === 'pickFouler') {
      return [...homeLineup.bench].sort((a, b) => a - b);
    }
    return [...homeActiveList].sort((a, b) => a - b);
  }, [foulFlow, homeLineup, homeActiveList]);

  const awayPanelNumbers = useMemo(() => {
    if (foulFlow !== 'idle' && foulFlow.step === 'pickFouler') {
      return [...awayLineup.bench].sort((a, b) => a - b);
    }
    return [...awayActiveList].sort((a, b) => a - b);
  }, [foulFlow, awayLineup, awayActiveList]);
  const homeRosterList = useMemo(() => fullRoster(homeLineup), [homeLineup]);
  const awayRosterList = useMemo(() => fullRoster(awayLineup), [awayLineup]);
  const activeRosterRef = useRef<{ home: number[]; away: number[] }>({
    home: compactOnCourt(cloneLineup(DEFAULT_TEAM_LINEUP)),
    away: compactOnCourt(cloneLineup(DEFAULT_TEAM_LINEUP)),
  });
  activeRosterRef.current = { home: homeActiveList, away: awayActiveList };

  const benchRosterRef = useRef<{ home: number[]; away: number[] }>({
    home: [...DEFAULT_TEAM_LINEUP.bench],
    away: [...DEFAULT_TEAM_LINEUP.bench],
  });
  benchRosterRef.current = { home: homeLineup.bench, away: awayLineup.bench };

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

  // End-of-quarter flow: show CTA, then arm next quarter without auto-start.
  useEffect(() => {
    if (!isRunning) return;
    if (timerSeconds !== 0) return;
    setIsRunning(false);
    if (quarter >= 4) {
      setTimerSeconds(0);
      return;
    }
    setQuarterBreakPending(true);
    setQuarterBreakModalOpen(true);
  }, [isRunning, timerSeconds, quarter]);

  // Jump-ball page -> StatDash: start the timer once the winner has been selected.
  useEffect(() => {
    const winner = readJumpBallWinner();
    if (!winner) return;
    setIsRunning(true);
    setQuarterBreakPending(false);
    clearJumpBallWinner();
  }, []);

  const onAdjustMinutes = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(QUARTER_DURATION_SEC, s + delta)));
  }, []);

  const onAdjustSeconds = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(QUARTER_DURATION_SEC, s + delta)));
  }, []);

  const onStartStop = useCallback(() => {
    if (quarterBreakPending) return;
    setIsRunning((r) => !r);
  }, [quarterBreakPending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (quarterBreakPending) return;
      e.preventDefault();
      setIsRunning((r) => !r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quarterBreakPending]);

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
        draft.ftCount < 1 ||
        draft.ftAssistJersey === null
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
      const assistPart =
        draft.ftAssistJersey === 'none'
          ? ' · No assist'
          : ` · Assist #${draft.ftAssistJersey}`;
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
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} #${draft.fouledJersey}; Shooter #${draft.fouledJersey}${assistPart}; FTs: ${ftStr}${rebSuffix}`,
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
      draft: { side, shooterJersey: jersey, shotType: null, result: 'made', fastBreak: false },
    });
  }, []);

  const openShotFlowFromCourt = useCallback((e: React.MouseEvent<HTMLElement>, result: 'made' | 'missed') => {
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
      draft: { ...emptyShotDraft(), result },
    });
  }, [captureCourtPoint]);

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
      const bench = side === 'home' ? benchRosterRef.current.home : benchRosterRef.current.away;
      if (!bench.includes(jersey)) return cur;
      return {
        ...cur,
        step: 'foulType',
        draft: { ...cur.draft, foulerSide: side, foulerJersey: jersey, foulerRole: 'bench' },
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
        step: 'ftAssist',
        draft: { ...draft, ftCount: count, ftResults: [], ftAssistJersey: null },
      });
    },
    [commitFoulNoFt, homeTeamColor, awayTeamColor]
  );

  const handleFoulFtAssistSelect = useCallback((assist: number | 'none') => {
    setFoulFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'ftAssist') return cur;
      const n = cur.draft.ftCount;
      const fj = cur.draft.fouledJersey;
      if (n === null || n < 1 || fj === null) return cur;
      if (assist !== 'none' && assist === fj) return cur;
      if (assist !== 'none') {
        const fouledSide = cur.draft.foulerSide !== null ? opponentOf(cur.draft.foulerSide) : null;
        if (fouledSide === null) return cur;
        const active = fouledSide === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
        if (!active.includes(assist)) return cur;
      }
      return {
        ...cur,
        step: 'ftResults',
        draft: { ...cur.draft, ftAssistJersey: assist },
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
      // Rebound only happens if the *last* free throw was missed.
      const lastMade = nextResults[n - 1] === 'made';
      if (lastMade) {
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
      if (cur.step === 'pickRebounder' && cur.draft.reboundBranch !== null) {
        return { ...cur, draft: { ...cur.draft, reboundBranch: null } };
      }
      if (cur.step === 'assist') {
        return { ...cur, step: 'shotType', draft: { ...cur.draft, shotType: null } };
      }
      if (cur.step === 'shotType') {
        if (cur.entry === 'court') {
          return { ...cur, step: 'pickShooter', draft: { ...emptyShotDraft(), result: cur.draft.result } };
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

  const handlePickRebounder = useCallback((side: TeamSide, jersey: number) => {
    const cur = shotFlowRef.current;
    if (cur === 'idle' || cur.step !== 'pickRebounder') return;

    const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
    if (!active.includes(jersey)) return;

    const teamName = side === 'home' ? homeName : awayName;
    const branch = cur.draft.reboundBranch;

    const logRebound = () => {
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: `#${jersey}`,
        action: 'rebound',
        result: 'Rebound',
      });
    };

    // Simple rebound: tap jersey only (no modal branch) — end flow.
    if (branch === null) {
      logRebound();
      pendingCourtClickRef.current = null;
      setShotFlow('idle');
      return;
    }

    // Block: offensive rebounder first, then blocker step.
    if (branch === 'block_involved') {
      logRebound();
      setShotFlow({
        ...cur,
        step: 'pickBlocker',
        draft: {
          ...cur.draft,
          rebounderSide: side,
          rebounderJersey: jersey,
          reboundBranch: null,
          blockerSide: null,
          blockerJersey: null,
          tipInCommit: false,
          side: null,
          shooterJersey: null,
          shotType: null,
          fastBreak: false,
        },
      });
      return;
    }

    // Tip-in: rebounder jersey, then immediate tip attempt after shooter pick (same player).
    let tipInShotType: ShotTypeId;
    let tipInResult: 'made' | 'missed';
    switch (branch) {
      case 'tipin_layup_miss':
        tipInShotType = 'layup';
        tipInResult = 'missed';
        break;
      case 'tipin_dunk_miss':
        tipInShotType = 'dunk';
        tipInResult = 'missed';
        break;
      case 'tipin_layup_made':
        tipInShotType = 'layup';
        tipInResult = 'made';
        break;
      case 'tipin_dunk_made':
        tipInShotType = 'dunk';
        tipInResult = 'made';
        break;
      default:
        return;
    }

    logRebound();
    setShotFlow({
      ...cur,
      step: 'pickShooter',
      draft: {
        ...cur.draft,
        rebounderSide: side,
        rebounderJersey: jersey,
        reboundBranch: null,
        tipInCommit: true,
        shotType: tipInShotType,
        result: tipInResult,
        side: null,
        shooterJersey: null,
        deadBallReason: null,
        fastBreak: false,
        blockerSide: null,
        blockerJersey: null,
      },
    });
  }, [appendLog, awayName, clockLabel, homeName, periodLabel]);

  const handlePickBlocker = useCallback((side: TeamSide, jersey: number) => {
    const cur = shotFlowRef.current;
    if (cur === 'idle' || cur.step !== 'pickBlocker') return;

    const expectedBlockerSide =
      cur.draft.rebounderSide === null ? null : opponentOf(cur.draft.rebounderSide);
    if (expectedBlockerSide === null) return;
    if (side !== expectedBlockerSide) return;

    const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
    if (!active.includes(jersey)) return;

    const teamName = side === 'home' ? homeName : awayName;
    appendLog({
      period: periodLabel,
      clock: clockLabel,
      team: teamName,
      player: `#${jersey}`,
      action: 'block',
      result: 'Block',
    });

    // Loop back into rebound selection.
    setShotFlow({
      ...cur,
      step: 'pickRebounder',
      draft: {
        ...cur.draft,
        blockerSide: side,
        blockerJersey: jersey,
        rebounderSide: null,
        rebounderJersey: null,
        tipInCommit: false,
        side: null,
        shooterJersey: null,
        shotType: null,
        reboundBranch: null,
        deadBallReason: null,
        fastBreak: false,
      },
    });
  }, [appendLog, awayName, clockLabel, homeName, periodLabel]);

  const handlePickShooter = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = shotFlowRef.current;
      if (cur === 'idle' || cur.step !== 'pickShooter') return;

      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;

      // Tip-ins commit immediately after selecting the shooter.
      if (cur.draft.tipInCommit) {
        if (cur.draft.shotType === null) return;
        const expectedShooterSide = cur.draft.rebounderSide;
        if (expectedShooterSide !== null && side !== expectedShooterSide) return;
        const result = cur.draft.result;

        const teamName = side === 'home' ? homeName : awayName;
        const points = getShotPoints(cur.draft.shotType);
        if (result === 'made') {
          if (side === 'home') setHomeScore((s) => s + points);
          else setAwayScore((s) => s + points);
        }

        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: teamName,
          player: `#${jersey}`,
          action: 'shot',
          result: shotTypeResultPhrase(cur.draft.shotType, result),
        });

        const clickPt = pendingCourtClickRef.current;
        if (clickPt) {
          const shotColor = side === 'home' ? homeTeamColor : awayTeamColor;
          setCourtShotMarkers((prev) => [
            ...prev,
            { ...clickPt, color: shotColor, kind: result === 'missed' ? 'missed' : 'made' },
          ]);
        }

        if (result === 'made') {
          pendingCourtClickRef.current = null;
          setShotFlow('idle');
        } else {
          // Missed tip-in: continue the live-ball rebound loop.
          setShotFlow({
            entry: 'court',
            step: 'pickRebounder',
            draft: { ...emptyShotDraft(), result: 'missed', tipInCommit: false },
          });
        }
        return;
      }

      setShotFlow({
        ...cur,
        step: 'shotType',
        draft: { ...cur.draft, side, shooterJersey: jersey },
      });
    },
    [
      appendLog,
      awayName,
      awayTeamColor,
      clockLabel,
      getShotPoints,
      homeName,
      homeTeamColor,
      periodLabel,
      setCourtShotMarkers,
    ]
  );

  const handleSelectReboundOutcome = useCallback(
    (outcome: ReboundOutcomeId) => {
      const cur = shotFlowRef.current;
      if (cur === 'idle' || cur.step !== 'pickRebounder') return;

      if (outcome === 'dead_out_of_bounds' || outcome === 'dead_shot_clock_violation') {
        const reason =
          outcome === 'dead_out_of_bounds' ? 'Out of bounds' : '24 sec violation';
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: 'Officials',
          player: '—',
          action: 'dead ball',
          result: reason,
        });
        pendingCourtClickRef.current = null;
        setShotFlow('idle');
        return;
      }

      setShotFlow({
        ...cur,
        draft: { ...cur.draft, reboundBranch: outcome },
      });
    },
    [appendLog, clockLabel, periodLabel]
  );

  const handleSelectShotType = useCallback((shotType: ShotTypeId) => {
    const cur = shotFlowRef.current;
    if (cur === 'idle' || cur.step !== 'shotType') return;
    const nextDraft = { ...cur.draft, shotType };
    if (
      nextDraft.result === 'missed' &&
      nextDraft.side !== null &&
      nextDraft.shooterJersey !== null
    ) {
      const teamName = nextDraft.side === 'home' ? homeName : awayName;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: `#${nextDraft.shooterJersey}`,
        action: 'shot',
        result: shotTypeResultPhrase(shotType, 'missed'),
      });
      if (cur.entry === 'court') {
        const clickPt = pendingCourtClickRef.current;
        if (clickPt && nextDraft.side !== null) {
          const shotColor = nextDraft.side === 'home' ? homeTeamColor : awayTeamColor;
          setCourtShotMarkers((prev) => [
            ...prev,
            { ...clickPt, color: shotColor, kind: nextDraft.result === 'missed' ? 'missed' : 'made' },
          ]);
        }
      }
      // After any missed shot, enter the live-ball rebound state (rebounder selection).
      if (nextDraft.result === 'missed') {
        setShotFlow({
          entry: 'court',
          step: 'pickRebounder',
          draft: { ...emptyShotDraft(), result: 'missed', tipInCommit: false },
        });
      } else {
        pendingCourtClickRef.current = null;
        setShotFlow('idle');
      }
      return;
    }
    setShotFlow({
      ...cur,
      step: 'assist',
      draft: nextDraft,
    });
  }, [appendLog, awayName, awayTeamColor, clockLabel, homeName, homeTeamColor, periodLabel]);

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
        isCourtClickThreePointer(pt.nx, pt.ny, draft.side, homeAttacksLeft);
      const points = isThreeFromCourt ? 3 : getShotPoints(draft.shotType);
      if (draft.result === 'made') {
        if (draft.side === 'home') setHomeScore((s) => s + points);
        else setAwayScore((s) => s + points);
      }

      const parts = [
        isThreeFromCourt ? '3pt made' : shotTypeResultPhrase(draft.shotType, draft.result),
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
          setCourtShotMarkers((prev) => [
            ...prev,
            { ...clickPt, color: shotColor, kind: draft.result === 'missed' ? 'missed' : 'made' },
          ]);
          pendingCourtClickRef.current = null;
        }
      } else {
        pendingCourtClickRef.current = null;
      }

      setShotFlow('idle');
    },
    [appendLog, awayName, awayTeamColor, clockLabel, homeAttacksLeft, homeName, homeTeamColor, periodLabel]
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

  const handleTurnoverSelectType = useCallback(
    (type: TurnoverTypeId) => {
      const cur = turnoverFlowRef.current;
      if (cur === 'idle' || cur.step !== 'turnoverType') return;
      const draft: TurnoverFlowDraft = { ...cur.draft, turnoverType: type };
      if (type === 'ball_handling' || type === 'bad_pass') {
        setTurnoverFlow({ ...cur, step: 'steal', draft });
        return;
      }
      commitTurnoverLog(draft, null);
      setTurnoverFlow('idle');
    },
    [commitTurnoverLog]
  );

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

  const handleSidePlayerPrimaryClick = useCallback((side: TeamSide, jersey: number) => {
    const activeShot = shotFlowRef.current;
    if (activeShot !== 'idle') {
      if (activeShot.step === 'pickRebounder') {
        handlePickRebounder(side, jersey);
        return;
      }
      if (activeShot.step === 'pickBlocker') {
        handlePickBlocker(side, jersey);
        return;
      }
      if (activeShot.step === 'pickShooter') {
        handlePickShooter(side, jersey);
        return;
      }
      if (
        activeShot.step === 'assist' &&
        activeShot.draft.side === side &&
        activeShot.draft.shooterJersey !== jersey
      ) {
        handleSelectAssist(jersey);
      }
      return;
    }

    const activeFoul = foulFlowRef.current;
    if (activeFoul !== 'idle') {
      if (activeFoul.step === 'pickFouler') {
        handleFoulPickFouler(side, jersey);
        return;
      }
      if (activeFoul.step === 'pickFouled') {
        const foulerSide = activeFoul.draft.foulerSide;
        if (foulerSide !== null && side === opponentOf(foulerSide)) {
          handleFoulPickFouled(jersey);
        }
        return;
      }
      if (activeFoul.step === 'ftAssist') {
        const fs = activeFoul.draft.foulerSide;
        if (fs === null) return;
        const fouledSide = opponentOf(fs);
        if (side !== fouledSide) return;
        const fj = activeFoul.draft.fouledJersey;
        if (fj === null || jersey === fj) return;
        handleFoulFtAssistSelect(jersey);
        return;
      }
      if (activeFoul.step === 'rebounder') {
        handleFoulPickRebounder(side, jersey);
      }
      return;
    }

    const activeTurnover = turnoverFlowRef.current;
    if (activeTurnover !== 'idle') {
      if (activeTurnover.step === 'pickPlayer' && side === activeTurnover.draft.committingSide) {
        handleTurnoverPickCommittingPlayer(jersey);
        return;
      }
      if (activeTurnover.step === 'steal' && side === opponentOf(activeTurnover.draft.committingSide)) {
        handleTurnoverPickStealer(side, jersey);
      }
    }
  }, [
    handleFoulFtAssistSelect,
    handleFoulPickFouled,
    handleFoulPickFouler,
    handleFoulPickRebounder,
    handlePickBlocker,
    handlePickRebounder,
    handlePickShooter,
    handleSelectAssist,
    handleTurnoverPickCommittingPlayer,
    handleTurnoverPickStealer,
  ]);

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
      // Start game clock as soon as the jump-ball winner is selected.
      setIsRunning(true);
      setQuarterBreakPending(false);
    },
    [appendLog, clockLabel, periodLabel, homeName, awayName]
  );

  const handleJumpBallCancel = useCallback(() => {
    setJumpBallModalOpen(false);
  }, []);

  const handleQuarterBreakConfirm = useCallback(() => {
    setQuarter((q) => Math.min(4, q + 1));
    setTimerSeconds(QUARTER_DURATION_SEC);
    setQuarterBreakPending(false);
    setQuarterBreakModalOpen(false);
  }, []);

  const handleQuarterBreakKeepReviewing = useCallback(() => {
    setQuarterBreakModalOpen(false);
  }, []);

  const handleOpenLogEditor = useCallback((entry: GameLogEntry) => {
    setEditingLog(entry);
  }, []);

  const handleCloseLogEditor = useCallback(() => {
    setEditingLog(null);
  }, []);

  const handleChangeEditingLog = useCallback((field: keyof GameLogEntry, value: string) => {
    setEditingLog((cur) => (cur ? { ...cur, [field]: value } : cur));
  }, []);

  const handleSaveEditingLog = useCallback(() => {
    if (editingLog === null) return;
    setGameLog((prev) => prev.map((entry) => (entry.id === editingLog.id ? editingLog : entry)));
    setEditingLog(null);
  }, [editingLog]);

  const periodOptions = ['Q1', 'Q2', 'Q3', 'Q4'];
  const actionOptions = [
    'shot',
    'foul',
    'turnover',
    'steal',
    'timeout',
    'jump ball',
    'substitution',
    'rebound',
    'block',
    'dead ball',
  ];
  const teamOptions = useMemo(
    () => Array.from(new Set([homeName, awayName, 'Officials', '—', ...gameLog.map((entry) => entry.team)])),
    [awayName, gameLog, homeName]
  );
  const playerOptions = useMemo(
    () => Array.from(new Set(['—', ...gameLog.map((entry) => entry.player)])),
    [gameLog]
  );
  const resultOptions = useMemo(
    () => Array.from(new Set(gameLog.map((entry) => entry.result))),
    [gameLog]
  );

  return (
    <div
      className="relative flex min-h-[90dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <StatisticianFullscreenGate />
      <MenuBar onSwitchTeamSide={() => setSwitchSidesOpen(true)} />

      <EdgeTeamDrawer
        edge="left"
        teamName={homeOnLeft ? homeName : awayName}
        teamColor={homeOnLeft ? homeTeamColor : awayTeamColor}
        roster={homeOnLeft ? homeRosterList : awayRosterList}
        entries={gameLog}
        open={activeDrawer === 'left'}
        onToggle={() => setActiveDrawer((cur) => (cur === 'left' ? null : 'left'))}
      />
      <EdgeTeamDrawer
        edge="right"
        teamName={homeOnLeft ? awayName : homeName}
        teamColor={homeOnLeft ? awayTeamColor : homeTeamColor}
        roster={homeOnLeft ? awayRosterList : homeRosterList}
        entries={gameLog}
        open={activeDrawer === 'right'}
        onToggle={() => setActiveDrawer((cur) => (cur === 'right' ? null : 'right'))}
      />

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
                reverseSides={!homeOnLeft}
              />
            </div>
          </div>

          <div className="relative">
            <GameCenter
              homeColor={homeTeamColor}
              awayColor={awayTeamColor}
              homeActivePlayers={homePanelNumbers}
              awayActivePlayers={awayPanelNumbers}
              onPlayerFoulClick={handleSidePlayerPrimaryClick}
              onPlayerShotContextMenu={(side, jersey) => openShotFlowFromPlayer(side, jersey)}
              onFoul={openFoulFlowFromPanelFoulButton}
              onTurnover={openTurnoverFlowFromPanel}
              onCourtFoulClick={(e) => openShotFlowFromCourt(e, 'missed')}
              onCourtShotContextMenu={(e) => openShotFlowFromCourt(e, 'made')}
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
                onSelectReboundOutcome={handleSelectReboundOutcome}
              onFoulFlowBack={handleFoulFlowBack}
              onFoulFlowCancel={handleFoulFlowCancel}
              onFoulPickFouler={handleFoulPickFouler}
              onFoulSelectType={handleFoulSelectType}
              onFoulPickFouled={handleFoulPickFouled}
              onFoulSelectFtCount={handleFoulSelectFtCount}
              onFoulFtAssistSelect={handleFoulFtAssistSelect}
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
              timeoutModalOpen={timeoutModalOpen}
              onTimeoutSelect={handleTimeoutSelect}
              onTimeoutCancel={handleTimeoutModalCancel}
              jumpBallModalOpen={jumpBallModalOpen}
              onJumpBallSelect={handleJumpBallSelect}
              onJumpBallCancel={handleJumpBallCancel}
              reverseSides={!homeOnLeft}
            />
            {subModalOpen && (
              <div className="absolute inset-0 z-30 flex items-center justify-center">
                <div className="flex h-full w-full max-w-[min(100%,980px)] px-3 py-1 sm:px-4 sm:py-2">
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
              </div>
            )}
          </div>

          <div className={`${STAT_DASH_MAIN_OUTER} shrink-0`}>
            <div
              className={`${STAT_DASH_MAIN_INNER} h-[min(220px,42dvh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm sm:h-[min(141px,36dvh)]`}
            >
              <GameLog entries={gameLog} onRowClick={handleOpenLogEditor} />
            </div>
          </div>
        </div>
      </div>

      {quarterBreakModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-bold text-gray-900">Quarter ended</h3>
            <p className="mt-2 text-sm text-gray-700">
              Have you finished adding all data for this quarter?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleQuarterBreakKeepReviewing}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={handleQuarterBreakConfirm}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Yes, next quarter
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-3">
          <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-bold text-gray-900">Edit Game Log Entry</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                Period
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={editingLog.period}
                  onChange={(e) => handleChangeEditingLog('period', e.target.value)}
                >
                  {periodOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                Team
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={editingLog.team}
                  onChange={(e) => handleChangeEditingLog('team', e.target.value)}
                >
                  {teamOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                Player
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={editingLog.player}
                  onChange={(e) => handleChangeEditingLog('player', e.target.value)}
                >
                  {playerOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                Action
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={editingLog.action}
                  onChange={(e) => handleChangeEditingLog('action', e.target.value)}
                >
                  {actionOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-gray-700">
                Result
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                  value={editingLog.result}
                  onChange={(e) => handleChangeEditingLog('result', e.target.value)}
                >
                  {resultOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseLogEditor}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditingLog}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <SwitchSidesModal
        open={switchSidesOpen}
        homeColor={homeTeamColor}
        awayColor={awayTeamColor}
        initialHomeOnLeft={homeOnLeft}
        initialHomeAttacksLeft={homeAttacksLeft}
        onClose={() => setSwitchSidesOpen(false)}
        onApply={(next) => {
          setHomeOnLeft(next.homeOnLeft);
          setHomeAttacksLeft(next.homeAttacksLeft);
          setSwitchSidesOpen(false);
        }}
      />

    </div>
  );
};

export default StatDash;
