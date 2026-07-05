import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatisticianFullscreenGate from '../../components/StatisticianFullscreenGate';
import MenuBar from './components/MenuBar';
import EdgeTeamDrawer from './components/EdgeTeamDrawer';
import StatusStrip from './components/StatusStrip';
import GameHeader from './components/GameHeader';
import GameCenter from './components/GameCenter';
import SubstitutionModal from './components/SubstitutionModal';
import SwitchSidesModal from './components/SwitchSidesModal';
import StartersModal from './components/StartersModal';
import { type TimeoutChoice } from './components/TimeoutSelectModal';
import type { JumpBallChoice } from './components/JumpBallModal';
import type { CourtMarker } from './components/BasketballCourt';
import GameLog from './components/GameLog';
import { formatClock } from './components/GameTimer';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { STAT_DASH, STAT_DASH_MAIN_INNER, STAT_DASH_MAIN_OUTER } from './statDashTheme';
import type { GameLogEntry, TeamSide } from './types';
import type { ActiveShotFlow, ReboundOutcomeId, ShotTypeId } from './shotRecordingUtils';
import {
  emptyShotDraft,
  getShotPoints,
  reboundBranchFromTipShot,
  shotTypeResultPhrase,
  snapshotPriorMiss,
} from './shotRecordingUtils';
import type {
  ActiveFoulFlow,
  FoulFlowDraft,
  FoulTypeId,
  PanelFoulPick,
} from './foulRecordingUtils';
import {
  foulFlowBack,
  foulFlowFromPanelPickAtPickFouler,
  foulTypeLabel,
  foulerLogPlayerField,
  initialFoulFlowFromCourt,
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
import {
  commandsApi,
  createSessionSseClient,
  projectionsApi,
  sessionsApi,
  type CommandAcceptedResponse,
  type SessionStateSnapshot,
  type RealtimeSessionMessage,
} from '../../services/statdash';
import { useMatch } from '../../api/hooks';
import {
  readStoredExpectedVersion,
  readStoredSessionContext,
  readStoredLineups,
  writeStoredExpectedVersion,
  writeStoredLineups,
} from '../../features/statdash/sessionContextStorage';
import { generateIdempotencyKey } from '../../features/statdash/utils';
import { useEventQueue } from '../../features/statdash/eventQueue/useEventQueue';
import type { QueuedEvent } from '../../features/statdash/eventQueue/types';

const DEFAULT_HOME = 'TEAM 1';
const DEFAULT_AWAY = 'TEAM 2';
const QUARTER_DURATION_SEC = 10 * 60;
/** Upper bound for manual clock adjustment (seconds). */
const MAX_TIMER_SECONDS = 60 * 60;

type ShotFlowState = 'idle' | ActiveShotFlow;
type FoulFlowState = 'idle' | ActiveFoulFlow;
type TurnoverFlowState = 'idle' | ActiveTurnoverFlow;

function newLogId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function StatDashStatusLine(props: {
  dotClassName: string;
  blink: boolean;
  textClassName?: string;
  children: React.ReactNode;
}) {
  const { dotClassName, blink, textClassName = 'text-xs text-gray-700', children } = props;
  return (
    <div className={`flex items-center gap-2 px-4 pt-2 ${textClassName}`}>
      <span
        className={`inline-block size-2 shrink-0 rounded-full ${dotClassName} ${
          blink ? 'motion-safe:animate-status-dot-blink' : ''
        }`}
        aria-hidden
      />
      <div className="min-w-0 leading-snug">{children}</div>
    </div>
  );
}

const StatDash: React.FC = () => {
  const navigate = useNavigate();
  const initialOrientation = useMemo(() => readGameSetupOrientation(), []);
  const [homeOnLeft, setHomeOnLeft] = useState(initialOrientation.homeOnLeft);
  const [homeAttacksLeft, setHomeAttacksLeft] = useState(initialOrientation.homeAttacksLeft);
  const { homeTeamColor, awayTeamColor } = useStatisticianTeamColors();
  const [homeName, setHomeName] = useState(DEFAULT_HOME);
  const [awayName, setAwayName] = useState(DEFAULT_AWAY);
  const sessionContextForMatch = useMemo(() => readStoredSessionContext(), []);
  const matchForNamesQuery = useMatch(sessionContextForMatch?.matchId);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [quarter, setQuarter] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(QUARTER_DURATION_SEC);
  const [isRunning, setIsRunning] = useState(false);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
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
  const [startGamePromptOpen, setStartGamePromptOpen] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeReconnecting, setRealtimeReconnecting] = useState(false);

  const [homeLineup, setHomeLineup] = useState<TeamLineup>(() => {
    const saved = readStoredLineups();
    if (saved) {
      console.log('[StatDash] Lineup loaded from sessionStorage:', {
        home: { onCourt: saved.home.onCourt, bench: saved.home.bench },
        away: { onCourt: saved.away.onCourt, bench: saved.away.bench },
      });
      return cloneLineup(saved.home);
    }
    console.warn('[StatDash] No saved lineup found — using DEFAULT_TEAM_LINEUP');
    return cloneLineup(DEFAULT_TEAM_LINEUP);
  });
  const [awayLineup, setAwayLineup] = useState<TeamLineup>(() => {
    const saved = readStoredLineups();
    return saved ? cloneLineup(saved.away) : cloneLineup(DEFAULT_TEAM_LINEUP);
  });

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
  /** After "Not yet" on quarter-ended modal: show yellow Finish to reopen that modal. */
  const [quarterEndAwaitingFinish, setQuarterEndAwaitingFinish] = useState(false);
  const [editingLog, setEditingLog] = useState<GameLogEntry | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [isReconcilingLog, setIsReconcilingLog] = useState(false);
  const [switchSidesOpen, setSwitchSidesOpen] = useState(false);
  const [startersModalOpen, setStartersModalOpen] = useState(false);

  const homeActiveList = useMemo(() => compactOnCourt(homeLineup), [homeLineup]);
  const awayActiveList = useMemo(() => compactOnCourt(awayLineup), [awayLineup]);

  const homePanelNumbers = useMemo(
    () => [...homeActiveList].sort((a, b) => a - b),
    [homeActiveList]
  );

  const awayPanelNumbers = useMemo(
    () => [...awayActiveList].sort((a, b) => a - b),
    [awayActiveList]
  );
  const homeRosterList = useMemo(() => fullRoster(homeLineup), [homeLineup]);
  const awayRosterList = useMemo(() => fullRoster(awayLineup), [awayLineup]);

  useEffect(() => {
    console.log('[StatDash] Panel numbers updated:', {
      home: { onCourt: homePanelNumbers, bench: homeLineup.bench },
      away: { onCourt: awayPanelNumbers, bench: awayLineup.bench },
    });
  }, [homePanelNumbers, awayPanelNumbers, homeLineup.bench, awayLineup.bench]);

  useEffect(() => {
    if (!matchForNamesQuery.data) return;
    const homeTeamPlayers = (matchForNamesQuery.data.homeTeam?.playerTeams ?? [])
      .map((pt) => ({ jersey: pt.jerseyNumber, player: pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : null }));
    const awayTeamPlayers = (matchForNamesQuery.data.awayTeam?.playerTeams ?? [])
      .map((pt) => ({ jersey: pt.jerseyNumber, player: pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : null }));
    console.log('[StatDash] Match roster from API:', {
      homeTeam: matchForNamesQuery.data.homeTeam?.name,
      homePlayers: homeTeamPlayers,
      awayTeam: matchForNamesQuery.data.awayTeam?.name,
      awayPlayers: awayTeamPlayers,
    });
  }, [matchForNamesQuery.data]);

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

  const captureCourtPoint = useCallback((e: React.MouseEvent<Element>) => {
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
  const latestVersionRef = useRef<number>(readStoredExpectedVersion());
  const pendingCountRef = useRef(0);
  const queueRef = useRef<QueuedEvent[]>([]);
  const markersRestoredRef = useRef(false);

  const applyAuthoritativeState = useCallback((state: SessionStateSnapshot) => {
    setHomeScore(state.score.home);
    setAwayScore(state.score.away);
    setQuarter(state.quarter);
    setTimerSeconds(state.clockSecondsRemaining);
    setIsRunning(state.status === 'IN_PROGRESS');
  }, []);

  const getTeamIdForSide = useCallback((side: TeamSide): string => {
    const context = readStoredSessionContext();
    if (side === 'home') return context?.homeTeamId ?? 'home_team';
    return context?.awayTeamId ?? 'away_team';
  }, []);

  // Jersey → real player UUID maps, built from the match roster data.
  // Used so event commands carry actual DB player IDs instead of synthetic composites.
  const homePlayerIdByJersey = useMemo(() => {
    const map = new Map<number, string>();
    for (const pt of matchForNamesQuery.data?.homeTeam?.playerTeams ?? []) {
      if (pt.player?.id && pt.jerseyNumber != null) {
        map.set(pt.jerseyNumber, pt.player.id);
      }
    }
    return map;
  }, [matchForNamesQuery.data]);

  const awayPlayerIdByJersey = useMemo(() => {
    const map = new Map<number, string>();
    for (const pt of matchForNamesQuery.data?.awayTeam?.playerTeams ?? []) {
      if (pt.player?.id && pt.jerseyNumber != null) {
        map.set(pt.jerseyNumber, pt.player.id);
      }
    }
    return map;
  }, [matchForNamesQuery.data]);

  const getPlayerId = useCallback((side: TeamSide, jersey: number): string => {
    const map = side === 'home' ? homePlayerIdByJersey : awayPlayerIdByJersey;
    // Fall back to synthetic ID if match data hasn't loaded yet
    return map.get(jersey) ?? `${getTeamIdForSide(side)}_${jersey}`;
  }, [homePlayerIdByJersey, awayPlayerIdByJersey, getTeamIdForSide]);

  const { enqueue, queue, pendingCount, failedCount, isOnline, retryFailed } = useEventQueue({
    onCommandAccepted: (event, response) => {
      writeStoredExpectedVersion(response.version);
      latestVersionRef.current = response.version;
      setHomeScore(response.score.home);
      setAwayScore(response.score.away);
      if (pendingCountRef.current === 0) {
        setSyncNotice(null);
      }
      // Link log entries to the real backend event ID so the edit modal can call correctEvent
      const backendEventId = response.emittedEvents?.[0]?.id;
      if (backendEventId && event.localId) {
        setGameLog((prev) =>
          prev.map((entry) =>
            entry.localId === event.localId ? { ...entry, backendEventId } : entry
          )
        );
      }
    },
    onCommandFailed: (_event, error) => {
      if (error instanceof Error) {
        setSyncNotice(error.message);
      }
    },
  });

  useEffect(() => {
    if (matchForNamesQuery.data?.homeTeam?.name) setHomeName(matchForNamesQuery.data.homeTeam.name);
    if (matchForNamesQuery.data?.awayTeam?.name) setAwayName(matchForNamesQuery.data.awayTeam.name);
  }, [matchForNamesQuery.data]);

  const homeRosterByJersey = useMemo(() => {
    const map = new Map<number, string>();
    for (const pt of matchForNamesQuery.data?.homeTeam?.playerTeams ?? []) {
      if (pt.player && pt.jerseyNumber != null) {
        const initial = pt.player.firstName.charAt(0);
        map.set(pt.jerseyNumber, `${initial}. ${pt.player.lastName}`);
      }
    }
    return map;
  }, [matchForNamesQuery.data]);

  const awayRosterByJersey = useMemo(() => {
    const map = new Map<number, string>();
    for (const pt of matchForNamesQuery.data?.awayTeam?.playerTeams ?? []) {
      if (pt.player && pt.jerseyNumber != null) {
        const initial = pt.player.firstName.charAt(0);
        map.set(pt.jerseyNumber, `${initial}. ${pt.player.lastName}`);
      }
    }
    return map;
  }, [matchForNamesQuery.data]);

  const getPlayerLabel = useCallback((side: TeamSide | null, jersey: number): string => {
    if (side === null) return `#${jersey}`;
    const name = (side === 'home' ? homeRosterByJersey : awayRosterByJersey).get(jersey);
    return name ? `#${jersey} ${name}` : `#${jersey}`;
  }, [homeRosterByJersey, awayRosterByJersey]);

  // Full registered roster from match data — used for the edge drawers so every
  // player shows regardless of which jersey numbers are currently in the lineup state.
  // Set deduplicates in case the API returns duplicate PlayerTeam records (Gap #7).
  const homeMatchRosterNumbers = useMemo(
    () =>
      [...new Set(
        (matchForNamesQuery.data?.homeTeam?.playerTeams ?? [])
          .filter((pt) => pt.jerseyNumber != null)
          .map((pt) => pt.jerseyNumber as number),
      )].sort((a, b) => a - b),
    [matchForNamesQuery.data],
  );
  const awayMatchRosterNumbers = useMemo(
    () =>
      [...new Set(
        (matchForNamesQuery.data?.awayTeam?.playerTeams ?? [])
          .filter((pt) => pt.jerseyNumber != null)
          .map((pt) => pt.jerseyNumber as number),
      )].sort((a, b) => a - b),
    [matchForNamesQuery.data],
  );

  // Real roster for the in-game Starters modal — only players in the active lineup (marked Playing during /starters).
  const homePlayersForStartersModal = useMemo(() => {
    const roster = matchForNamesQuery.data?.homeTeam?.playerTeams ?? [];
    const activeJerseys = new Set(homeRosterList);
    return roster
      .filter((pt) => pt.player && activeJerseys.has(pt.jerseyNumber ?? 0))
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchForNamesQuery.data, homeRosterList]);
  const awayPlayersForStartersModal = useMemo(() => {
    const roster = matchForNamesQuery.data?.awayTeam?.playerTeams ?? [];
    const activeJerseys = new Set(awayRosterList);
    return roster
      .filter((pt) => pt.player && activeJerseys.has(pt.jerseyNumber ?? 0))
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchForNamesQuery.data, awayRosterList]);

  useEffect(() => {
    pendingCountRef.current = pendingCount;
    queueRef.current = queue;
  }, [pendingCount, queue]);

  const commitEventCommand = useCallback(
    async (
      commandType: string,
      payload: Record<string, unknown>,
    ): Promise<(CommandAcceptedResponse & { localId: string }) | null> => {
      const context = readStoredSessionContext();
      if (!context) {
        navigate('/match-key', { replace: true });
        return null;
      }
      const idempotencyKey = generateIdempotencyKey();
      const expectedVersion = readStoredExpectedVersion();

      writeStoredExpectedVersion(expectedVersion + 1);
      latestVersionRef.current = expectedVersion + 1;

      enqueue({
        sessionId: context.sessionId,
        commandType,
        payload: payload as Record<string, unknown>,
        expectedVersion,
        localId: idempotencyKey,
      });

      return {
        sessionId: context.sessionId,
        version: expectedVersion + 1,
        score: { home: homeScore, away: awayScore },
        emittedEvents: [],
        localId: idempotencyKey,
      };
    },
    [enqueue, homeScore, awayScore, navigate],
  );

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
    setQuarterEndAwaitingFinish(false);
  }, [isRunning, timerSeconds, quarter]);

  // Jump-ball page -> StatDash: prompt before starting the game clock.
  useEffect(() => {
    const bootstrap = async () => {
      const context = readStoredSessionContext();
      if (!context) {
        navigate('/match-key', { replace: true });
        return;
      }
      setIsBootstrapping(true);
      setBootError(null);
      try {
        const snapshot = await sessionsApi.bootstrapSession({ sessionId: context.sessionId });
        applyAuthoritativeState(snapshot);
        writeStoredExpectedVersion(snapshot.version);
        latestVersionRef.current = snapshot.version;
        const winner = readJumpBallWinner();
        if (winner && snapshot.status !== 'IN_PROGRESS') {
          setStartGamePromptOpen(true);
          setQuarterBreakPending(false);
        }
        clearJumpBallWinner();
      } catch (error) {
        setBootError(error instanceof Error ? error.message : 'Failed to bootstrap game session');
      } finally {
        setIsBootstrapping(false);
      }
    };
    void bootstrap();
  }, [applyAuthoritativeState, navigate]);

  // After bootstrap, restore shot markers from the server-side shot chart projection.
  // Runs once — the ref guard prevents re-runs if homeTeamColor/awayTeamColor update later.
  useEffect(() => {
    if (isBootstrapping) return;
    if (markersRestoredRef.current) return;
    markersRestoredRef.current = true;
    const context = readStoredSessionContext();
    if (!context) return;
    void (async () => {
      try {
        const shots = await projectionsApi.getShotChart(context.sessionId);
        const markers = shots
          .filter((s) => s.x != null && s.y != null)
          .map((s) => ({
            nx: s.x as number,
            ny: s.y as number,
            color: s.teamId === context.homeTeamId ? homeTeamColor : awayTeamColor,
            kind: s.result === 'made' ? ('made' as const) : ('missed' as const),
          }));
        if (markers.length > 0) setCourtShotMarkers(markers);
      } catch {
        // Court markers are cosmetic — silently ignore fetch failures on reconnect
      }
    })();
  }, [isBootstrapping, homeTeamColor, awayTeamColor]);

  useEffect(() => {
    const context = readStoredSessionContext();
    if (!context) return;

    const applyRealtimeMessage = async (message: RealtimeSessionMessage) => {
      if (message.sessionId !== context.sessionId) return;
      if (message.state.version <= latestVersionRef.current) return;
      const hasActiveDraft =
        shotFlowRef.current !== 'idle' ||
        foulFlowRef.current !== 'idle' ||
        turnoverFlowRef.current !== 'idle' ||
        subModalOpenRef.current ||
        pendingCountRef.current > 0 ||
        queueRef.current.some((event) => event.status === 'inflight');

      if (hasActiveDraft) {
        setSyncNotice('Live update received. Finish this step to auto-sync.');
        return;
      }

      try {
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest);
        latestVersionRef.current = latest.version;
        writeStoredExpectedVersion(latest.version);
        setSyncNotice(null);
      } catch {
        setSyncNotice('Realtime sync update failed. Pull to refresh state.');
      }
    };

    const client = createSessionSseClient(context.sessionId, {
      onConnected: () => {
        setRealtimeConnected(true);
        setRealtimeReconnecting(false);
        void (async () => {
          try {
            const latest = await sessionsApi.getSessionState(context.sessionId);
            if (latest.version > latestVersionRef.current) {
              applyAuthoritativeState(latest);
              latestVersionRef.current = latest.version;
              writeStoredExpectedVersion(latest.version);
            }
          } catch {
            setSyncNotice('Connected but could not refresh latest session state.');
          }
        })();
      },
      onMessage: (message) => {
        void applyRealtimeMessage(message);
      },
      onDisconnected: () => {
        setRealtimeConnected(false);
        setRealtimeReconnecting(true);
      },
      onError: () => {
        setRealtimeConnected(false);
        setRealtimeReconnecting(true);
      },
    });

    return () => {
      client.close();
      setRealtimeConnected(false);
    };
    // Keep deps minimal: queue/pendingCount updates would tear down EventSource and show
    // DevTools "(canceled)" after every command; draft checks use refs above.
  }, [applyAuthoritativeState]);

  const handleStartGamePromptConfirm = useCallback(async () => {
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsStartingGame(true);
    try {
      await sessionsApi.startSession(context.sessionId);
      const latest = await sessionsApi.getSessionState(context.sessionId);
      writeStoredExpectedVersion(latest.version);
      latestVersionRef.current = latest.version;
      applyAuthoritativeState(latest);
      setQuarterBreakPending(false);
      setStartGamePromptOpen(false);
    } catch {
      setIsRunning(true);
      setQuarterBreakPending(false);
      setStartGamePromptOpen(false);
    } finally {
      setIsStartingGame(false);
    }
  }, [applyAuthoritativeState, navigate]);

  const handleStartGamePromptSkip = useCallback(() => {
    setStartGamePromptOpen(false);
  }, []);

  const onAdjustMinutes = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(MAX_TIMER_SECONDS, s + delta)));
  }, []);

  const onAdjustSeconds = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, Math.min(MAX_TIMER_SECONDS, s + delta)));
  }, []);

  const onStartStop = useCallback(() => {
    setIsRunning((r) => !r);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      setIsRunning((r) => !r);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commitFoulNoFt = useCallback(
    async (draft: FoulFlowDraft) => {
      if (
        !isFoulerDraftComplete(draft) ||
        draft.foulType === null ||
        draft.fouledJersey === null
      ) {
        return;
      }
      const foulerTeamName = draft.foulerSide === 'home' ? homeName : awayName;
      const fouledSide = opponentOf(draft.foulerSide!);
      const fouledTeamName = fouledSide === 'home' ? homeName : awayName;
      // Bench/coach fouls: backend requires foulerPlayerId so we can't submit them
      let committed = null;
      if (draft.foulerRole === 'player') {
        committed = await commitEventCommand('foul', {
          teamId: draft.foulerSide ? getTeamIdForSide(draft.foulerSide) : undefined,
          foulerPlayerId:
            draft.foulerSide && typeof draft.foulerJersey === 'number'
              ? getPlayerId(draft.foulerSide, draft.foulerJersey)
              : undefined,
          fouledPlayerId:
            draft.foulerSide !== null && typeof draft.fouledJersey === 'number'
              ? getPlayerId(opponentOf(draft.foulerSide), draft.fouledJersey)
              : undefined,
          foulType: draft.foulType,
          freeThrowsAwarded: 0,
          freeThrows: [],
        });
        if (!committed) return;
      }
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: foulerLogPlayerField(draft, getPlayerLabel),
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} ${getPlayerLabel(fouledSide, draft.fouledJersey)}; No FT`,
        localId: committed?.localId,
        meta: {
          foulerSide: draft.foulerSide,
          foulerJersey: draft.foulerJersey,
          foulerRole: draft.foulerRole,
          foulType: draft.foulType,
          fouledJersey: draft.fouledJersey,
          ftCount: 0,
          ftResults: [],
          ftAssistJersey: null,
          reboundSide: null,
          reboundJersey: null,
        },
      });
    },
    [appendLog, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, periodLabel, homeName, awayName]
  );

  const commitFoulWithFtSequence = useCallback(
    async (draft: FoulFlowDraft, opts?: { skipRebound?: boolean }) => {
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
      // Bench/coach fouls: backend requires foulerPlayerId so we can't submit them
      let foulCmd = null;
      if (draft.foulerRole === 'player') {
        foulCmd = await commitEventCommand('foul', {
          teamId: draft.foulerSide ? getTeamIdForSide(draft.foulerSide) : undefined,
          foulerPlayerId:
            draft.foulerSide && typeof draft.foulerJersey === 'number'
              ? getPlayerId(draft.foulerSide, draft.foulerJersey)
              : undefined,
          fouledPlayerId:
            draft.foulerSide !== null && typeof draft.fouledJersey === 'number'
              ? getPlayerId(opponentOf(draft.foulerSide), draft.fouledJersey)
              : undefined,
          foulType: draft.foulType,
          freeThrowsAwarded: draft.ftCount,
          freeThrows: draft.ftResults.map((r, i) => ({
            attemptNumber: i + 1,
            result: r === 'made' ? 'made' : 'missed',
          })),
        });
        if (!foulCmd) return;
      }
      const foulerTeamName = draft.foulerSide === 'home' ? homeName : awayName;
      const fouledSide = opponentOf(draft.foulerSide!);
      const fouledTeamName = fouledSide === 'home' ? homeName : awayName;
      const makes = draft.ftResults.filter((r) => r === 'made').length;
      if (fouledSide === 'home') setHomeScore((s) => s + makes);
      else setAwayScore((s) => s + makes);

      const foulMeta = {
        foulerSide: draft.foulerSide,
        foulerJersey: draft.foulerJersey,
        foulerRole: draft.foulerRole,
        foulType: draft.foulType,
        fouledJersey: draft.fouledJersey,
        ftCount: draft.ftCount,
        ftResults: draft.ftResults,
        ftAssistJersey: draft.ftAssistJersey,
        reboundSide: draft.reboundSide,
        reboundJersey: draft.reboundJersey,
      };

      // Foul row
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: foulerLogPlayerField(draft, getPlayerLabel),
        action: 'foul',
        result: `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} ${getPlayerLabel(fouledSide, draft.fouledJersey)}`,
        localId: foulCmd?.localId,
        meta: foulMeta,
      });

      // Per-FT rows (share the foul's localId so reversing the foul removes them all)
      for (let i = 0; i < draft.ftResults.length; i++) {
        const isMade = draft.ftResults[i] === 'made';
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: fouledTeamName,
          player: getPlayerLabel(fouledSide, draft.fouledJersey),
          action: 'free throw',
          result: `${isMade ? 'Made' : 'Missed'} (${i + 1}/${draft.ftResults.length})`,
          localId: foulCmd?.localId,
          meta: foulMeta,
        });
      }

      // Assist row if first FT was made and an assister was chosen
      const firstFtMade = draft.ftResults[0] === 'made';
      if (firstFtMade && typeof draft.ftAssistJersey === 'number') {
        const assistCmd = await commitEventCommand('assist', {
          teamId: getTeamIdForSide(fouledSide),
          playerId: getPlayerId(fouledSide, draft.ftAssistJersey),
          assistedPlayerId: getPlayerId(fouledSide, draft.fouledJersey!),
        });
        if (assistCmd) {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: fouledTeamName,
            player: getPlayerLabel(fouledSide, draft.ftAssistJersey),
            action: 'assist',
            result: `To ${getPlayerLabel(fouledSide, draft.fouledJersey)} (FT)`,
            localId: assistCmd.localId,
            meta: {
              side: fouledSide,
              assistJersey: draft.ftAssistJersey,
              assistedJersey: draft.fouledJersey,
            },
          });
        }
      }

      // Rebound row (local only — FT rebound backend commit is tracked separately)
      if (!skipRebound && draft.reboundSide !== null && draft.reboundJersey !== null) {
        const rebTeamName = draft.reboundSide === 'home' ? homeName : awayName;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: rebTeamName,
          player: getPlayerLabel(draft.reboundSide, draft.reboundJersey),
          action: 'rebound',
          result: `${draft.reboundSide === fouledSide ? 'Off' : 'Def'} Rebound`,
          meta: {
            side: draft.reboundSide,
            jersey: draft.reboundJersey,
            reboundType: draft.reboundSide === fouledSide ? 'offensive' : 'defensive',
          },
        });
      }
    },
    [appendLog, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, periodLabel, homeName, awayName]
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
      draft: { ...emptyShotDraft(), side, shooterJersey: jersey, shotType: null, result: 'made' },
    });
  }, []);

  const openShotFlowFromCourt = useCallback((e: React.MouseEvent<Element>, result: 'made' | 'missed') => {
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
    // Shift+left-click on court: foul at location (pick fouler); normal click: shot flow.
    if (e.shiftKey && result === 'missed') {
      captureCourtPoint(e);
      setShotFlow('idle');
      setTurnoverFlow('idle');
      setFoulFlow(initialFoulFlowFromCourt());
      return;
    }
    captureCourtPoint(e);
    setFoulFlow('idle');
    setTurnoverFlow('idle');
    setShotFlow({
      entry: 'court',
      step: 'pickShooter',
      draft: { ...emptyShotDraft(), result },
    });
  }, [captureCourtPoint]);

  /** FOUL strip: open modal (on-court / bench / coach). While `pickFouler`, reopen modal without resetting flow. */
  const openFoulFlowFromPanelFoulButton = useCallback((_side: TeamSide) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current
    )
      return;
    const curFoul = foulFlowRef.current;
    if (curFoul !== 'idle') {
      if (curFoul.step === 'pickFouler') {
        setFoulPickerOpen(true);
        return;
      }
      return;
    }
    pendingCourtClickRef.current = null;
    setShotFlow('idle');
    setTurnoverFlow('idle');
    setFoulFlow('idle');
    setFoulPickerOpen(true);
  }, []);

  const handleFoulPanelPickerSelect = useCallback((side: TeamSide, pick: PanelFoulPick) => {
    setFoulPickerOpen(false);
    setFoulFlow((cur) => {
      if (cur !== 'idle' && cur.step === 'pickFouler') {
        return foulFlowFromPanelPickAtPickFouler(cur, side, pick);
      }
      if (cur === 'idle') {
        return initialFoulFlowFromPanelSelection(side, pick);
      }
      return cur;
    });
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
      turnoverFlowRef.current !== 'idle'
    )
      return;
    pendingCourtClickRef.current = null;
    setShotFlow('idle');
    setFoulFlow('idle');
    setFoulPickerOpen(false);
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
      const bench = side === 'home' ? benchRosterRef.current.home : benchRosterRef.current.away;
      const onCourt = active.includes(jersey);
      const onBench = bench.includes(jersey);
      if (!onCourt && !onBench) return cur;
      return {
        ...cur,
        step: 'foulType',
        draft: {
          ...cur.draft,
          foulerSide: side,
          foulerJersey: jersey,
          foulerRole: onCourt ? 'player' : 'bench',
        },
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
        void commitFoulNoFt(draft);
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
        void commitFoulWithFtSequence(finished, { skipRebound: true });
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
      const finished = { ...draft, ftResults: nextResults };
      const fromCourt = cur.entry === 'court';
      void commitFoulWithFtSequence(finished, { skipRebound: true });
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
      const fouledSide = finished.foulerSide !== null ? opponentOf(finished.foulerSide) : null;
      setFoulFlow('idle');
      setShotFlow({
        entry: cur.entry === 'court' ? 'court' : 'player',
        step: 'pickRebounder',
        draft: {
          ...emptyShotDraft(),
          result: 'missed',
          side: fouledSide,
        },
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
      void commitFoulWithFtSequence(draft);
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
    const cur = shotFlowRef.current;
    if (cur === 'idle') return;

    // Tip-in putback picker: return to the outcome buttons (reboundBranch: null).
    // No rebound log to undo — rebound is committed only when the shooter jersey is tapped,
    // not when the outcome type (Layup Made / Dunk Miss / etc.) is selected.
    if (cur.step === 'pickShooter' && cur.draft.tipInCommit && cur.draft.priorMiss !== null) {
      const pm = cur.draft.priorMiss;
      setShotFlow({
        entry: cur.entry,
        step: 'pickRebounder',
        draft: {
          ...emptyShotDraft(),
          result: 'missed',
          tipInCommit: false,
          side: pm.side,
          shooterJersey: pm.shooterJersey,
          shotType: pm.shotType,
          fastBreak: pm.fastBreak,
          reboundBranch: null,
          priorMiss: pm,
          // Restore block context so the post-block screen shows correctly on Back.
          // For non-block tip-ins cur.draft.blockerSide is already null.
          blockerSide: cur.draft.blockerSide,
          blockerJersey: cur.draft.blockerJersey,
        },
      });
      return;
    }

    // Court: initial shooter pick — leave flow (same as cancel for this step).
    if (cur.step === 'pickShooter' && !cur.draft.tipInCommit && cur.entry === 'court') {
      clearPendingCourtPoint();
      setShotFlow('idle');
      return;
    }

    // Blocker step: go back to rebound options.
    if (cur.step === 'pickBlocker') {
      setShotFlow({
        ...cur,
        step: 'pickRebounder',
        draft: {
          ...cur.draft,
          reboundBranch: null,
          blockerSide: null,
          blockerJersey: null,
        },
      });
      return;
    }

    // After block: rebound options — undo latest block log; back to blocker jersey step.
    if (
      cur.step === 'pickRebounder' &&
      cur.draft.reboundBranch === null &&
      cur.draft.blockerSide !== null
    ) {
      setGameLog((prev) => {
        const head = prev[0];
        if (head && head.action === 'block') return prev.slice(1);
        return prev;
      });
      setShotFlow({
        ...cur,
        step: 'pickBlocker',
        draft: {
          ...cur.draft,
          blockerSide: null,
          blockerJersey: null,
        },
      });
      return;
    }

    // Initial rebounder screen after a miss (court or panel): shot type + undo miss log / court marker.
    if (
      cur.step === 'pickRebounder' &&
      (cur.entry === 'court' || cur.entry === 'player') &&
      cur.draft.reboundBranch === null &&
      cur.draft.blockerSide === null &&
      cur.draft.lastOffensiveRebound === null
    ) {
      const d = cur.draft;
      if (d.side !== null && d.shooterJersey !== null && d.shotType !== null) {
        setGameLog((prev) => {
          const head = prev[0];
          if (
            head &&
            head.action === 'shot' &&
            head.player === `#${d.shooterJersey}` &&
            /missed/i.test(head.result)
          ) {
            return prev.slice(1);
          }
          return prev;
        });
        if (cur.entry === 'court') {
          setCourtShotMarkers((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (last.kind === 'missed') return prev.slice(0, -1);
            return prev;
          });
        }
        setShotFlow({
          entry: cur.entry,
          step: 'shotType',
          draft: {
            ...emptyShotDraft(),
            result: 'missed',
            tipInCommit: false,
            side: d.side,
            shooterJersey: d.shooterJersey,
            shotType: d.shotType,
            fastBreak: d.fastBreak,
          },
        });
        return;
      }
    }

    setShotFlow((inner) => {
      if (inner === 'idle') return inner;
      if (inner.step === 'pickRebounder' && inner.draft.reboundBranch !== null) {
        return { ...inner, draft: { ...inner.draft, reboundBranch: null } };
      }
      if (inner.step === 'assist') {
        return { ...inner, step: 'shotType', draft: { ...inner.draft, shotType: null } };
      }
      if (inner.step === 'shotType') {
        if (inner.entry === 'court') {
          return {
            ...inner,
            step: 'pickShooter',
            draft: { ...emptyShotDraft(), result: inner.draft.result },
          };
        }
        return 'idle';
      }
      return inner;
    });
  }, [clearPendingCourtPoint]);

  const handleModalCancel = useCallback(() => {
    clearPendingCourtPoint();
    setShotFlow('idle');
  }, [clearPendingCourtPoint]);

  const handlePickRebounder = useCallback((side: TeamSide, jersey: number) => {
    // Read the current flow from the ref (not a setShotFlow updater) — React does not
    // guarantee the updater callback runs synchronously, so a closure variable set inside
    // it and read immediately after the setShotFlow(...) call can still be null/stale.
    const prev = shotFlowRef.current;
    if (prev === 'idle' || prev.step !== 'pickRebounder') return;

    const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
    if (!active.includes(jersey)) return;

    const teamName = side === 'home' ? homeName : awayName;
    const branch = prev.draft.reboundBranch;
    const reboundLogRow: Omit<GameLogEntry, 'id'> = {
      period: periodLabel,
      clock: clockLabel,
      team: teamName,
      player: getPlayerLabel(side, jersey),
      action: 'rebound',
      result: 'Def Rebound',
      meta: { side, jersey, reboundType: 'defensive' },
    };

    let nextFlow: ShotFlowState;

    // Simple rebound: tap jersey only (no modal branch) — end flow.
    if (branch === null) {
      pendingCourtClickRef.current = null;
      nextFlow = 'idle';
    } else if (branch === 'block_involved') {
      // Block: offensive rebounder first, then blocker step.
      const priorMiss = snapshotPriorMiss(prev.draft);
      nextFlow = {
        ...prev,
        step: 'pickBlocker',
        draft: {
          ...prev.draft,
          priorMiss,
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
          lastOffensiveRebound: null,
        },
      };
    } else {
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

      const priorMiss = snapshotPriorMiss(prev.draft);
      nextFlow = {
        ...prev,
        step: 'pickShooter',
        draft: {
          ...prev.draft,
          priorMiss,
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
          lastOffensiveRebound: null,
        },
      };
    }

    setShotFlow(nextFlow);

    void (async () => {
      const committed = await commitEventCommand('rebound', {
        teamId: getTeamIdForSide(side),
        playerId: getPlayerId(side, jersey),
        reboundType: 'defensive',
      });
      if (!committed) return;
      appendLog({ ...reboundLogRow, localId: committed.localId });
    })();
  }, [appendLog, awayName, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, homeName, periodLabel]);

  const handlePickBlocker = useCallback((side: TeamSide, jersey: number) => {
    const prev = shotFlowRef.current;
    if (prev === 'idle' || prev.step !== 'pickBlocker') return;

    const offenseSide =
      prev.draft.priorMiss?.side ??
      prev.draft.side ??
      (prev.draft.blockerSide !== null ? opponentOf(prev.draft.blockerSide) : null);
    const expectedBlockerSide = offenseSide === null ? null : opponentOf(offenseSide);
    if (expectedBlockerSide === null) return;
    if (side !== expectedBlockerSide) return;

    const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
    if (!active.includes(jersey)) return;

    const teamName = side === 'home' ? homeName : awayName;
    const blockedShooter: { side: TeamSide; jersey: number } | null =
      offenseSide !== null && prev.draft.shooterJersey !== null
        ? { side: offenseSide, jersey: prev.draft.shooterJersey }
        : null;
    const blockLogRow: Omit<GameLogEntry, 'id'> = {
      period: periodLabel,
      clock: clockLabel,
      team: teamName,
      player: getPlayerLabel(side, jersey),
      action: 'block',
      result: 'Block',
      meta: { side, jersey },
    };

    setShotFlow({
      ...prev,
      step: 'pickRebounder',
      draft: {
        ...prev.draft,
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
        lastOffensiveRebound: null,
      },
    });

    if (blockedShooter) {
      void (async () => {
        const committed = await commitEventCommand('block', {
          teamId: getTeamIdForSide(side),
          blockerPlayerId: getPlayerId(side, jersey),
          againstPlayerId: getPlayerId(blockedShooter.side, blockedShooter.jersey),
        });
        if (!committed) return;
        appendLog({ ...blockLogRow, localId: committed.localId });
      })();
    }
  }, [appendLog, awayName, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, homeName, periodLabel]);

  const handlePickShooter = useCallback(
    (side: TeamSide, jersey: number) => {
      const prev = shotFlowRef.current;
      if (prev === 'idle' || prev.step !== 'pickShooter') return;

      const active = side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;

      if (prev.draft.tipInCommit) {
        const { shotType, result } = prev.draft;
        if (shotType === null) return;

        // Missed tip-in → next rebound screen. Carry the shooter's identity so
        // snapshotPriorMiss works correctly at the next rebound level.
        setShotFlow(
          result === 'made'
            ? 'idle'
            : {
                entry: 'court',
                step: 'pickRebounder',
                draft: {
                  ...emptyShotDraft(),
                  result: 'missed',
                  tipInCommit: false,
                  side,
                  shooterJersey: jersey,
                  shotType,
                },
              }
        );

        void (async () => {
          const teamName = side === 'home' ? homeName : awayName;
          const playerLabel = getPlayerLabel(side, jersey);

          // Rebounder = shooter — commit the offensive rebound first.
          const reboundCommitted = await commitEventCommand('rebound', {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, jersey),
            reboundType: 'offensive',
          });
          if (reboundCommitted) {
            appendLog({
              period: periodLabel,
              clock: clockLabel,
              team: teamName,
              player: playerLabel,
              action: 'rebound',
              result: 'Off Rebound',
              localId: reboundCommitted.localId,
              meta: { side, jersey, reboundType: 'offensive' },
            });
          }

          const committed = await commitEventCommand('shot', {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(side, jersey),
            shotValue: getShotPoints(shotType),
            result,
          });
          if (!committed) return;
          const points = getShotPoints(shotType);
          if (result === 'made') {
            if (side === 'home') setHomeScore((x) => x + points);
            else setAwayScore((x) => x + points);
          }

          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: teamName,
            player: playerLabel,
            action: 'shot',
            result: shotTypeResultPhrase(shotType, result),
            localId: committed.localId,
            meta: { side, shooterJersey: jersey, shotType, shotValue: getShotPoints(shotType), result },
          });

          const clickPt = pendingCourtClickRef.current;
          if (clickPt) {
            const shotColor = side === 'home' ? homeTeamColor : awayTeamColor;
            setCourtShotMarkers((prevM) => [
              ...prevM,
              { ...clickPt, color: shotColor, kind: result === 'missed' ? 'missed' : 'made' },
            ]);
          }

          if (result === 'made') {
            pendingCourtClickRef.current = null;
          }
        })();
        return;
      }

      setShotFlow({
        ...prev,
        step: 'shotType',
        draft: { ...prev.draft, side, shooterJersey: jersey },
      });
    },
    [
      appendLog,
      awayName,
      awayTeamColor,
      clockLabel,
      getPlayerId,
      getPlayerLabel,
      getShotPoints,
      getTeamIdForSide,
      homeName,
      homeTeamColor,
      periodLabel,
      setCourtShotMarkers,
      commitEventCommand,
    ]
  );

  const handleSelectReboundOutcome = useCallback(
    (outcome: ReboundOutcomeId) => {
      const prev = shotFlowRef.current;
      if (prev === 'idle' || prev.step !== 'pickRebounder') return;

      if (outcome === 'dead_out_of_bounds' || outcome === 'dead_shot_clock_violation') {
        const reason = outcome === 'dead_out_of_bounds' ? 'Out of bounds' : '24 sec violation';
        const deadBallLogRow: Omit<GameLogEntry, 'id'> = {
          period: periodLabel,
          clock: clockLabel,
          team: 'Officials',
          player: '—',
          action: 'dead ball',
          result: reason,
        };
        pendingCourtClickRef.current = null;
        setShotFlow('idle');

        void (async () => {
          const committed = await commitEventCommand('dead_ball', {
            reason: outcome === 'dead_out_of_bounds' ? 'out_of_bounds' : 'shot_clock_violation',
          });
          if (!committed) return;
          appendLog(deadBallLogRow);
        })();
        return;
      }

      // Block: go directly to pickBlocker — skip the "tap offensive rebounder jersey" step.
      // Preserve side/shooterJersey so handlePickBlocker can identify the blocked player.
      if (outcome === 'block_involved') {
        const priorMiss = snapshotPriorMiss(prev.draft);
        setShotFlow({
          ...prev,
          step: 'pickBlocker',
          draft: {
            ...prev.draft,
            priorMiss,
            rebounderSide: null,
            rebounderJersey: null,
            reboundBranch: null,
            blockerSide: null,
            blockerJersey: null,
            tipInCommit: false,
            lastOffensiveRebound: null,
          },
        });
        return;
      }

      // Tip-in outcomes: rebounder = shooter. Skip the intermediate "tap rebounder jersey"
      // step and go directly to pickShooter. A single jersey tap will commit both the
      // offensive rebound and the tip-in shot to the same player.
      let tipInShotType: ShotTypeId;
      let tipInResult: 'made' | 'missed';
      switch (outcome) {
        case 'tipin_layup_miss': tipInShotType = 'layup'; tipInResult = 'missed'; break;
        case 'tipin_dunk_miss': tipInShotType = 'dunk'; tipInResult = 'missed'; break;
        case 'tipin_layup_made': tipInShotType = 'layup'; tipInResult = 'made'; break;
        case 'tipin_dunk_made': tipInShotType = 'dunk'; tipInResult = 'made'; break;
        default: return;
      }
      // In a post-block context side/shooterJersey are cleared, so snapshotPriorMiss returns
      // null. Fall back to the already-stored priorMiss so Back navigation still works.
      const priorMiss = snapshotPriorMiss(prev.draft) ?? prev.draft.priorMiss;
      setShotFlow({
        ...prev,
        step: 'pickShooter',
        draft: {
          ...prev.draft,
          priorMiss,
          rebounderSide: null,
          rebounderJersey: null,
          reboundBranch: null,
          tipInCommit: true,
          shotType: tipInShotType,
          result: tipInResult,
          side: null,
          shooterJersey: null,
          deadBallReason: null,
          fastBreak: false,
          // blockerSide/blockerJersey intentionally preserved from prev.draft:
          // - non-block tip-ins: already null, no change
          // - post-block tip-ins: kept so handleModalBack can restore the post-block screen
          lastOffensiveRebound: null,
        },
      });
    },
    [appendLog, clockLabel, commitEventCommand, periodLabel]
  );

  const handleSelectShotType = useCallback(async (shotType: ShotTypeId) => {
    const cur = shotFlowRef.current;
    if (cur === 'idle' || cur.step !== 'shotType') return;
    const nextDraft = { ...cur.draft, shotType };
    if (
      nextDraft.result === 'missed' &&
      nextDraft.side !== null &&
      nextDraft.shooterJersey !== null
    ) {
      const teamName = nextDraft.side === 'home' ? homeName : awayName;
      const missedPt = cur.entry === 'court' ? pendingCourtClickRef.current : null;
      const committed = await commitEventCommand('shot', {
        teamId: nextDraft.side ? getTeamIdForSide(nextDraft.side) : undefined,
        shooterPlayerId:
          nextDraft.side && typeof nextDraft.shooterJersey === 'number'
            ? getPlayerId(nextDraft.side, nextDraft.shooterJersey)
            : undefined,
        shotValue: getShotPoints(shotType),
        result: 'missed',
        ...(missedPt ? { x: missedPt.nx, y: missedPt.ny } : {}),
      });
      if (!committed) return;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: nextDraft.side ? getPlayerLabel(nextDraft.side, nextDraft.shooterJersey) : `#${nextDraft.shooterJersey}`,
        action: 'shot',
        result: shotTypeResultPhrase(shotType, 'missed'),
        localId: committed.localId,
        meta: {
          side: nextDraft.side,
          shooterJersey: nextDraft.shooterJersey,
          shotType,
          shotValue: getShotPoints(shotType),
          result: 'missed',
          ...(missedPt ? { x: missedPt.nx, y: missedPt.ny } : {}),
        },
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
          draft: {
            ...emptyShotDraft(),
            result: 'missed',
            tipInCommit: false,
            side: nextDraft.side,
            shooterJersey: nextDraft.shooterJersey,
            shotType,
            fastBreak: nextDraft.fastBreak,
          },
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
  }, [appendLog, awayName, awayTeamColor, clockLabel, commitEventCommand, getPlayerLabel, homeName, homeTeamColor, periodLabel]);

  const handleSetFastBreak = useCallback((fastBreak: boolean) => {
    setShotFlow((cur) => {
      if (cur === 'idle' || cur.step !== 'shotType') return cur;
      return { ...cur, draft: { ...cur.draft, fastBreak } };
    });
  }, []);

  const handleSelectAssist = useCallback(
    async (assist: number | 'none') => {
      const cur = shotFlowRef.current;
      if (cur === 'idle' || cur.step !== 'assist') return;
      const { draft } = cur;
      if (draft.side === null || draft.shooterJersey === null || draft.shotType === null) return;
      if (assist !== 'none' && assist === draft.shooterJersey) return;
      if (assist !== 'none') {
        const active = draft.side === 'home' ? activeRosterRef.current.home : activeRosterRef.current.away;
        if (!active.includes(assist)) return;
      }


      const pt = pendingCourtClickRef.current;
      const isThreeFromCourt =
        cur.entry === 'court' &&
        pt !== null &&
        draft.side !== null &&
        isCourtClickThreePointer(pt.nx, pt.ny, draft.side, homeAttacksLeft);
      const points = isThreeFromCourt ? 3 : getShotPoints(draft.shotType);

      const shotCmd = await commitEventCommand('shot', {
        teamId: draft.side ? getTeamIdForSide(draft.side) : undefined,
        shooterPlayerId:
          draft.side && typeof draft.shooterJersey === 'number'
            ? getPlayerId(draft.side, draft.shooterJersey)
            : undefined,
        shotValue: points,
        result: draft.result,
        ...(cur.entry === 'court' && pt ? { x: pt.nx, y: pt.ny } : {}),
      });
      if (!shotCmd) return;

      // Fix A: send assist command when a shot is made with an assister
      let assistCmd: typeof shotCmd | null = null;
      if (assist !== 'none' && draft.result === 'made') {
        assistCmd = await commitEventCommand('assist', {
          teamId: getTeamIdForSide(draft.side),
          playerId: getPlayerId(draft.side, assist),
          assistedPlayerId: getPlayerId(draft.side, draft.shooterJersey),
        });
      }

      const teamName = draft.side === 'home' ? homeName : awayName;
      if (draft.result === 'made') {
        if (draft.side === 'home') setHomeScore((s) => s + points);
        else setAwayScore((s) => s + points);
      }

      const shotResultParts = [
        isThreeFromCourt ? '3pt made' : shotTypeResultPhrase(draft.shotType, draft.result),
      ];
      if (draft.fastBreak) shotResultParts.push('Fast break');
      const shotResult = shotResultParts.join(' · ');

      if (assist !== 'none') {
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: teamName,
          player: getPlayerLabel(draft.side, assist),
          action: 'assist',
          result: `To ${getPlayerLabel(draft.side, draft.shooterJersey)}`,
          localId: assistCmd?.localId,
          meta: {
            side: draft.side,
            assistJersey: assist,
            assistedJersey: draft.shooterJersey,
          },
        });
      }
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: getPlayerLabel(draft.side, draft.shooterJersey),
        action: 'shot',
        result: shotResult,
        localId: shotCmd.localId,
        meta: {
          side: draft.side,
          shooterJersey: draft.shooterJersey,
          shotType: draft.shotType,
          shotValue: points,
          result: draft.result,
          ...(cur.entry === 'court' && pt ? { x: pt.nx, y: pt.ny } : {}),
        },
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
    [appendLog, awayName, awayTeamColor, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, homeAttacksLeft, homeName, homeTeamColor, periodLabel]
  );

  const commitTurnoverLog = useCallback(
    async (draft: TurnoverFlowDraft, steal: { side: TeamSide; jersey: number } | null) => {
      if (draft.committingJersey === null || draft.turnoverType === null) return;
      const committed = await commitEventCommand('turnover', {
        teamId: getTeamIdForSide(draft.committingSide),
        playerId:
          draft.committingJersey !== null
            ? getPlayerId(draft.committingSide, draft.committingJersey)
            : undefined,
        turnoverType: draft.turnoverType,
      });
      if (!committed) return;
      const committingTeam = draft.committingSide === 'home' ? homeName : awayName;
      const typeLabel = turnoverTypeLabel(draft.turnoverType);
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: committingTeam,
        player: getPlayerLabel(draft.committingSide, draft.committingJersey),
        action: 'turnover',
        result: typeLabel,
        localId: committed.localId,
        meta: {
          side: draft.committingSide,
          jersey: draft.committingJersey,
          turnoverType: draft.turnoverType,
        },
      });
      if (steal !== null) {
        const stealTeam = steal.side === 'home' ? homeName : awayName;
        const stealCmd = await commitEventCommand('steal', {
          teamId: getTeamIdForSide(steal.side),
          playerId: getPlayerId(steal.side, steal.jersey),
          againstPlayerId: getPlayerId(draft.committingSide, draft.committingJersey),
        });
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: stealTeam,
          player: getPlayerLabel(steal.side, steal.jersey),
          action: 'steal',
          result: `Off ${getPlayerLabel(draft.committingSide, draft.committingJersey)} turnover`,
          localId: stealCmd?.localId,
          meta: {
            side: steal.side,
            jersey: steal.jersey,
          },
        });
      }
    },
    [appendLog, clockLabel, commitEventCommand, getPlayerId, getPlayerLabel, getTeamIdForSide, periodLabel, homeName, awayName]
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
      void commitTurnoverLog(draft, null);
      setTurnoverFlow('idle');
    },
    [commitTurnoverLog]
  );

  const handleTurnoverNoSteal = useCallback(() => {
    const cur = turnoverFlowRef.current;
    if (cur === 'idle' || cur.step !== 'steal') return;
    void commitTurnoverLog(cur.draft, null);
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
      void commitTurnoverLog(draft, { side, jersey });
      setTurnoverFlow('idle');
    },
    [commitTurnoverLog]
  );

  const handleSidePlayerPrimaryClick = useCallback((side: TeamSide, jersey: number) => {
    if (foulPickerOpenRef.current && foulFlowRef.current === 'idle') {
      handleFoulPanelPickerSelect(side, { kind: 'player', jersey });
      return;
    }

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
    handleFoulPanelPickerSelect,
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
    const summary = `${formatSubstitutionDiff(homeName, homeDiff)} · ${formatSubstitutionDiff(awayName, awayDiff)}`;
    void (async () => {
      const submitTeamSubs = async (
        side: TeamSide,
        diff: { out: number[]; in: number[] },
      ): Promise<boolean> => {
        if (diff.out.length !== diff.in.length) {
          setSyncNotice('Substitution mismatch detected. Keep one-out/one-in pairs per team.');
          return false;
        }
        for (let idx = 0; idx < diff.out.length; idx += 1) {
          const committed = await commitEventCommand('substitution', {
            teamId: getTeamIdForSide(side),
            playerOutId: getPlayerId(side, diff.out[idx]),
            playerInId: getPlayerId(side, diff.in[idx]),
          });
          if (!committed) return false;
        }
        return true;
      };

      if (!(await submitTeamSubs('home', homeDiff))) return;
      if (!(await submitTeamSubs('away', awayDiff))) return;

      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: '—',
        player: '—',
        action: 'substitution',
        result: summary,
      });
      const nextHomeLineup = cloneLineup(subDraftHome);
      const nextAwayLineup = cloneLineup(subDraftAway);
      setHomeLineup(nextHomeLineup);
      setAwayLineup(nextAwayLineup);
      // Persist so a refresh/remount (including resuming an in-progress game) picks up
      // this substitution instead of reverting to the pre-game Starters submission.
      writeStoredLineups({ home: nextHomeLineup, away: nextAwayLineup });
      setSubModalOpen(false);
      setSyncNotice(null);
    })();
  }, [
    subDraftHome,
    subDraftAway,
    homeLineup,
    awayLineup,
    appendLog,
    clockLabel,
    commitEventCommand,
    periodLabel,
    homeName,
    awayName,
  ]);

  const handleSubstitutionCancel = useCallback(() => {
    setSubModalOpen(false);
  }, []);

  const handleTimeoutSelect = useCallback(
    (choice: TimeoutChoice) => {
      void (async () => {
        // Official timeouts have no owning team — backend requires teamId so we skip the command
        if (choice !== 'officials') {
          const committed = await commitEventCommand('timeout', {
            teamId: getTeamIdForSide(choice),
            timeoutType: 'full',
          });
          if (!committed) return;
        }
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
      })();
    },
    [appendLog, clockLabel, commitEventCommand, getTeamIdForSide, periodLabel, homeName, awayName]
  );

  const handleTimeoutModalCancel = useCallback(() => {
    setTimeoutModalOpen(false);
  }, []);

  const handleJumpBallSelect = useCallback(
    (choice: JumpBallChoice) => {
      void (async () => {
        const committed = await commitEventCommand('jump_ball', {
          winningTeamId: choice === 'home'
            ? (readStoredSessionContext()?.homeTeamId ?? 'home_team')
            : (readStoredSessionContext()?.awayTeamId ?? 'away_team'),
        });
        if (!committed) return;
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
      })();
    },
    [appendLog, clockLabel, commitEventCommand, periodLabel, homeName, awayName]
  );

  const handleJumpBallCancel = useCallback(() => {
    setJumpBallModalOpen(false);
  }, []);

  const handleQuarterBreakConfirm = useCallback(() => {
    setQuarter((q) => Math.min(4, q + 1));
    setTimerSeconds(QUARTER_DURATION_SEC);
    setQuarterBreakPending(false);
    setQuarterEndAwaitingFinish(false);
    setQuarterBreakModalOpen(false);
    // Court overlay only ever shows the current quarter's shots — the full shot history
    // still lives on the backend and is what the post-game shot chart page reads from.
    setCourtShotMarkers([]);
    setCourtFoulMarkers([]);
  }, []);

  const handleQuarterBreakKeepReviewing = useCallback(() => {
    setQuarterBreakModalOpen(false);
    setQuarterEndAwaitingFinish(true);
  }, []);

  const handleQuarterFinishReopen = useCallback(() => {
    setQuarterBreakModalOpen(true);
  }, []);

  const handleClearGameLog = useCallback(() => {
    if (!window.confirm('Clear the entire game log? This cannot be undone.')) return;
    setGameLog([]);
  }, []);

  const handleOpenLogEditor = useCallback((entry: GameLogEntry) => {
    setEditingLog(entry);
    setEditDraft(entry.meta ? { ...entry.meta } : {});
  }, []);

  const handleCloseLogEditor = useCallback(() => {
    setEditingLog(null);
    setEditDraft({});
  }, []);

  const handleSaveEditingLog = useCallback(() => {
    if (editingLog === null) return;
    if (!editingLog.backendEventId) {
      setSyncNotice('Waiting for sync confirmation. Try again in a moment.');
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsReconcilingLog(true);
    void (async () => {
      try {
        let correctedPayload: Record<string, unknown>;
        const action = editingLog.action;
        if (action === 'shot') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(side, editDraft.shooterJersey as number),
            shotValue: editDraft.shotValue as number,
            result: editDraft.result as string,
            ...(editDraft.x != null ? { x: editDraft.x } : {}),
            ...(editDraft.y != null ? { y: editDraft.y } : {}),
          };
        } else if (action === 'assist') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.assistJersey as number),
            assistedPlayerId: getPlayerId(side, editDraft.assistedJersey as number),
          };
        } else if (action === 'foul' || action === 'free throw') {
          const foulerSide = editDraft.foulerSide as TeamSide;
          const fouledSide = opponentOf(foulerSide);
          correctedPayload = {
            teamId: getTeamIdForSide(foulerSide),
            foulerPlayerId:
              typeof editDraft.foulerJersey === 'number'
                ? getPlayerId(foulerSide, editDraft.foulerJersey)
                : undefined,
            fouledPlayerId:
              typeof editDraft.fouledJersey === 'number'
                ? getPlayerId(fouledSide, editDraft.fouledJersey)
                : undefined,
            foulType: editDraft.foulType as string,
            freeThrowsAwarded: editDraft.ftCount as number,
            freeThrows: ((editDraft.ftResults as string[]) ?? []).map((r, i) => ({
              attemptNumber: i + 1,
              result: r,
            })),
          };
        } else if (action === 'turnover') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
            turnoverType: editDraft.turnoverType as string,
          };
        } else if (action === 'steal') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
          };
        } else if (action === 'rebound') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
            reboundType: editDraft.reboundType as string,
          };
        } else if (action === 'block') {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            blockerPlayerId: getPlayerId(side, editDraft.jersey as number),
          };
        } else {
          setSyncNotice('This event type cannot be edited. Use Reverse to undo it.');
          setIsReconcilingLog(false);
          return;
        }

        const response = await commandsApi.correctEvent(editingLog.backendEventId, {
          reason: 'Corrected from StatDash log editor',
          correctedPayload,
        });
        writeStoredExpectedVersion(response.version);
        latestVersionRef.current = response.version;
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest);
        setEditingLog(null);
        setEditDraft({});
        setSyncNotice('Correction submitted and synced.');
      } catch (error) {
        setSyncNotice(error instanceof Error ? error.message : 'Failed to correct event.');
      } finally {
        setIsReconcilingLog(false);
      }
    })();
  }, [applyAuthoritativeState, editDraft, editingLog, getPlayerId, getTeamIdForSide, navigate]);

  const handleReverseEditingLog = useCallback(() => {
    if (editingLog === null) return;
    if (!editingLog.backendEventId) {
      setSyncNotice('Waiting for sync confirmation. Try again in a moment.');
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsReconcilingLog(true);
    void (async () => {
      try {
        const response = await commandsApi.reverseEvent(editingLog.backendEventId!, {
          reason: 'Reversed from StatDash log editor',
        });
        writeStoredExpectedVersion(response.version);
        latestVersionRef.current = response.version;
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest);
        // Remove this entry and any sibling entries sharing the same localId (e.g. foul + FTs)
        setGameLog((prev) =>
          editingLog.localId
            ? prev.filter((e) => e.localId !== editingLog.localId)
            : prev.filter((e) => e.id !== editingLog.id)
        );
        setEditingLog(null);
        setEditDraft({});
        setSyncNotice('Event reversed and synced.');
      } catch (error) {
        setSyncNotice(error instanceof Error ? error.message : 'Failed to reverse event.');
      } finally {
        setIsReconcilingLog(false);
      }
    })();
  }, [applyAuthoritativeState, editingLog, navigate]);


  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;

      if (editingLog !== null) {
        e.preventDefault();
        setEditingLog(null);
        return;
      }
      if (subModalOpen) {
        e.preventDefault();
        handleSubstitutionCancel();
        return;
      }
      if (quarterBreakModalOpen) {
        e.preventDefault();
        setQuarterBreakModalOpen(false);
        setQuarterEndAwaitingFinish(true);
        return;
      }
      if (switchSidesOpen) {
        e.preventDefault();
        setSwitchSidesOpen(false);
        return;
      }
      if (startersModalOpen) {
        e.preventDefault();
        setStartersModalOpen(false);
        return;
      }
      if (timeoutModalOpen) {
        e.preventDefault();
        handleTimeoutModalCancel();
        return;
      }
      if (jumpBallModalOpen) {
        e.preventDefault();
        handleJumpBallCancel();
        return;
      }
      if (foulPickerOpen) {
        e.preventDefault();
        handleFoulPanelPickerCancel();
        return;
      }
      if (shotFlowRef.current !== 'idle') {
        e.preventDefault();
        handleModalCancel();
        return;
      }
      if (foulFlowRef.current !== 'idle') {
        e.preventDefault();
        handleFoulFlowCancel();
        return;
      }
      if (turnoverFlowRef.current !== 'idle') {
        e.preventDefault();
        handleTurnoverFlowCancel();
        return;
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [
    editingLog,
    subModalOpen,
    quarterBreakModalOpen,
    switchSidesOpen,
    startersModalOpen,
    timeoutModalOpen,
    jumpBallModalOpen,
    foulPickerOpen,
    handleSubstitutionCancel,
    handleTimeoutModalCancel,
    handleJumpBallCancel,
    handleFoulPanelPickerCancel,
    handleModalCancel,
    handleFoulFlowCancel,
    handleTurnoverFlowCancel,
  ]);

  return (
    <div
      className="relative flex min-h-[90dvh] flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <StatisticianFullscreenGate />
      <MenuBar
        onSwitchTeamSide={() => setSwitchSidesOpen(true)}
        onStarters={() => setStartersModalOpen(true)}
        onClearGameLog={handleClearGameLog}
      />

      <EdgeTeamDrawer
        edge="left"
        teamName={homeOnLeft ? homeName : awayName}
        teamColor={homeOnLeft ? homeTeamColor : awayTeamColor}
        roster={homeOnLeft ? homeMatchRosterNumbers : awayMatchRosterNumbers}
        rosterByJersey={homeOnLeft ? homeRosterByJersey : awayRosterByJersey}
        entries={gameLog}
        open={activeDrawer === 'left'}
        onToggle={() => setActiveDrawer((cur) => (cur === 'left' ? null : 'left'))}
      />
      <EdgeTeamDrawer
        edge="right"
        teamName={homeOnLeft ? awayName : homeName}
        teamColor={homeOnLeft ? awayTeamColor : homeTeamColor}
        roster={homeOnLeft ? awayMatchRosterNumbers : homeMatchRosterNumbers}
        rosterByJersey={homeOnLeft ? awayRosterByJersey : homeRosterByJersey}
        entries={gameLog}
        open={activeDrawer === 'right'}
        onToggle={() => setActiveDrawer((cur) => (cur === 'right' ? null : 'right'))}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <StatDashStatusLine
          dotClassName={
            realtimeReconnecting ? 'bg-amber-500' : realtimeConnected ? 'bg-emerald-500' : 'bg-gray-400'
          }
          blink={realtimeReconnecting}
        >
          {realtimeReconnecting
            ? 'Realtime: reconnecting…'
            : realtimeConnected
              ? 'Realtime: connected'
              : 'Realtime: offline'}
        </StatDashStatusLine>
        <StatDashStatusLine
          dotClassName={
            !isOnline
              ? 'bg-orange-500'
              : failedCount > 0
                ? 'bg-red-500'
                : pendingCount > 0
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
          }
          blink={!isOnline || failedCount > 0 || pendingCount > 0}
        >
          {!isOnline ? (
            'Offline — recording locally'
          ) : failedCount > 0 ? (
            <>
              {failedCount} event(s) failed to sync{' '}
              <button type="button" className="underline" onClick={retryFailed}>
                Retry
              </button>
            </>
          ) : pendingCount > 0 ? (
            <>{pendingCount} event(s) queued</>
          ) : (
            'All events synced'
          )}
        </StatDashStatusLine>
        {isBootstrapping && (
          <StatDashStatusLine dotClassName="bg-amber-500" blink textClassName="text-sm text-gray-600">
            Syncing game session…
          </StatDashStatusLine>
        )}
        {/* {bootError && (
          <StatDashStatusLine dotClassName="bg-red-500" blink textClassName="text-sm text-red-600">
            {bootError}
          </StatDashStatusLine>
        )}
        {syncNotice && (
          <StatDashStatusLine dotClassName="bg-amber-500" blink textClassName="text-sm text-amber-800">
            {syncNotice}
          </StatDashStatusLine>
        )} */}
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
                showQuarterFinish={quarterEndAwaitingFinish}
                onQuarterFinish={handleQuarterFinishReopen}
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
              homeRosterByJersey={homeRosterByJersey}
              awayRosterByJersey={awayRosterByJersey}
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

      {startGamePromptOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <h3 className="text-base font-bold text-gray-900">Start game?</h3>
            <p className="mt-2 text-sm text-gray-700">
              Jump ball is set. Do you want to start the game clock now?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleStartGamePromptSkip}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={isStartingGame}
                onClick={handleStartGamePromptConfirm}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {isStartingGame ? 'Starting…' : 'Start game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog && (() => {
        const action = editingLog.action;
        const hasSyncId = Boolean(editingLog.backendEventId);
        // Determine team side from meta for player roster lookups
        const editSide = (editDraft.side ?? editDraft.foulerSide) as TeamSide | undefined;
        const editRosterNums = editSide === 'home' ? homeRosterList : editSide === 'away' ? awayRosterList : [];
        const foulerSideEdit = editDraft.foulerSide as TeamSide | undefined;
        const fouledSideEdit = foulerSideEdit ? opponentOf(foulerSideEdit) : undefined;
        const foulerRoster = foulerSideEdit === 'home' ? homeRosterList : foulerSideEdit === 'away' ? awayRosterList : [];
        const fouledRoster = fouledSideEdit === 'home' ? homeRosterList : fouledSideEdit === 'away' ? awayRosterList : [];

        const sel = 'rounded border border-gray-300 px-2 py-1.5 text-sm w-full';
        const lbl = 'flex flex-col gap-1 text-xs font-semibold text-gray-700';

        const canEdit = ['shot','assist','foul','free throw','turnover','steal','rebound','block'].includes(action);

        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-3">
            <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 capitalize">{action} — Edit</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {editingLog.period} · {editingLog.clock} · {editingLog.team}
                  </p>
                </div>
                {!hasSyncId && (
                  <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    Pending sync
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {action === 'shot' && editSide && (
                  <>
                    <label className={lbl}>
                      Shooter
                      <select className={sel} value={editDraft.shooterJersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, shooterJersey: +e.target.value}))}>
                        {editRosterNums.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={lbl}>
                      Result
                      <select className={sel} value={editDraft.result as string ?? 'made'}
                        onChange={e => setEditDraft(d => ({...d, result: e.target.value}))}>
                        <option value="made">Made</option>
                        <option value="missed">Missed</option>
                      </select>
                    </label>
                    <label className={lbl}>
                      Shot value
                      <select className={sel} value={editDraft.shotValue as number ?? 2}
                        onChange={e => setEditDraft(d => ({...d, shotValue: +e.target.value}))}>
                        <option value={1}>1 pt (Free throw)</option>
                        <option value={2}>2 pt</option>
                        <option value={3}>3 pt</option>
                      </select>
                    </label>
                  </>
                )}

                {action === 'assist' && editSide && (
                  <>
                    <label className={lbl}>
                      Assister
                      <select className={sel} value={editDraft.assistJersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, assistJersey: +e.target.value}))}>
                        {editRosterNums.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={lbl}>
                      Assisted player
                      <select className={sel} value={editDraft.assistedJersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, assistedJersey: +e.target.value}))}>
                        {editRosterNums.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {(action === 'foul' || action === 'free throw') && foulerSideEdit && fouledSideEdit && (
                  <>
                    <p className="text-xs text-gray-500 -mb-1">
                      Foul type: <span className="font-semibold text-gray-700">{foulTypeLabel(editDraft.foulType as FoulTypeId)}</span>
                    </p>
                    <label className={lbl}>
                      Fouler
                      <select className={sel} value={editDraft.foulerJersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, foulerJersey: +e.target.value}))}>
                        {foulerRoster.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(foulerSideEdit, j)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={lbl}>
                      Fouled player
                      <select className={sel} value={editDraft.fouledJersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, fouledJersey: +e.target.value}))}>
                        {fouledRoster.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(fouledSideEdit, j)}</option>
                        ))}
                      </select>
                    </label>
                    {Array.isArray(editDraft.ftResults) && (editDraft.ftResults as string[]).length > 0 && (
                      <div className={lbl}>
                        Free throw results
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(editDraft.ftResults as string[]).map((r, i) => (
                            <button key={i} type="button"
                              onClick={() => setEditDraft(d => {
                                const next = [...(d.ftResults as string[])];
                                next[i] = next[i] === 'made' ? 'missed' : 'made';
                                return { ...d, ftResults: next };
                              })}
                              className={`rounded px-3 py-1 text-sm font-semibold ${r === 'made' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                            >
                              FT {i + 1}: {r === 'made' ? 'Made' : 'Missed'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {action === 'turnover' && editSide && (
                  <>
                    <label className={lbl}>
                      Player
                      <select className={sel} value={editDraft.jersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, jersey: +e.target.value}))}>
                        {editRosterNums.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-gray-500">
                      Type: <span className="font-semibold text-gray-700">{turnoverTypeLabel(editDraft.turnoverType as TurnoverTypeId)}</span>
                    </p>
                  </>
                )}

                {(action === 'steal' || action === 'block') && editSide && (
                  <label className={lbl}>
                    Player
                    <select className={sel} value={editDraft.jersey as number ?? ''}
                      onChange={e => setEditDraft(d => ({...d, jersey: +e.target.value}))}>
                      {editRosterNums.map(j => (
                        <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                      ))}
                    </select>
                  </label>
                )}

                {action === 'rebound' && editSide && (
                  <>
                    <label className={lbl}>
                      Player
                      <select className={sel} value={editDraft.jersey as number ?? ''}
                        onChange={e => setEditDraft(d => ({...d, jersey: +e.target.value}))}>
                        {editRosterNums.map(j => (
                          <option key={j} value={j}>{getPlayerLabel(editSide, j)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={lbl}>
                      Type
                      <select className={sel} value={editDraft.reboundType as string ?? 'defensive'}
                        onChange={e => setEditDraft(d => ({...d, reboundType: e.target.value}))}>
                        <option value="offensive">Offensive</option>
                        <option value="defensive">Defensive</option>
                      </select>
                    </label>
                  </>
                )}

                {!canEdit && (
                  <p className="text-sm text-gray-600 rounded bg-gray-50 p-3">
                    This event type cannot be edited directly. Use <strong>Reverse</strong> to undo it.
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" disabled={isReconcilingLog}
                  onClick={handleCloseLogEditor}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="button" disabled={isReconcilingLog || !hasSyncId}
                  onClick={handleReverseEditingLog}
                  className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40">
                  {isReconcilingLog ? 'Applying…' : 'Reverse'}
                </button>
                {canEdit && (
                  <button type="button" disabled={isReconcilingLog || !hasSyncId}
                    onClick={handleSaveEditingLog}
                    className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40">
                    {isReconcilingLog ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

      <StartersModal
        open={startersModalOpen}
        onClose={() => setStartersModalOpen(false)}
        homeLineup={homeLineup}
        awayLineup={awayLineup}
        homePlayers={homePlayersForStartersModal.length > 0 ? homePlayersForStartersModal : undefined}
        awayPlayers={awayPlayersForStartersModal.length > 0 ? awayPlayersForStartersModal : undefined}
        homeName={homeName}
        awayName={awayName}
        onApply={({ home, away }) => {
          setHomeLineup(home);
          setAwayLineup(away);
          // Same as substitutions — without this, a refresh/remount reverts to the
          // pre-game Starters submission and silently discards this edit.
          writeStoredLineups({ home, away });
        }}
      />

    </div>
  );
};

export default StatDash;
