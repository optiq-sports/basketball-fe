import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import StatisticianFullscreenGate from "../../components/StatisticianFullscreenGate";
import MenuBar from "./components/MenuBar";
import EdgeTeamDrawer from "./components/EdgeTeamDrawer";
import GameHeader from "./components/GameHeader";
import GameCenter from "./components/GameCenter";
import SubstitutionModal from "./components/SubstitutionModal";
import SwitchSidesModal from "./components/SwitchSidesModal";
import StartersModal from "./components/StartersModal";
import { type TimeoutChoice } from "./components/TimeoutSelectModal";
import type { JumpBallChoice } from "./components/JumpBallModal";
import type { CourtMarker } from "./components/BasketballCourt";
import GameLog from "./components/GameLog";
import { formatClock } from "./components/GameTimer";
import { useStatisticianTeamColors } from "../../contexts/StatisticianTeamColorsContext";
import { STAT_DASH } from "./statDashTheme";
import type { GameLogEntry, TeamSide } from "./types";
import { formatPeriodLabel, REGULATION_QUARTERS } from "./periodLabel";
import type {
  ActiveShotFlow,
  ReboundOutcomeId,
  ShotTypeId,
} from "./shotRecordingUtils";
import {
  emptyShotDraft,
  getShotPoints,
  reboundBranchFromTipShot,
  shotTypeResultPhrase,
  shotTypeToApiType,
  snapshotPriorMiss,
} from "./shotRecordingUtils";
import type {
  ActiveFoulFlow,
  FoulFlowDraft,
  FoulTypeId,
  PanelFoulPick,
} from "./foulRecordingUtils";
import {
  foulFlowBack,
  foulFlowFromPanelPickAtPickFouler,
  foulTypeLabel,
  foulTypeToApiType,
  foulerLogPlayerField,
  initialFoulFlowFromCourt,
  initialFoulFlowFromPanelSelection,
  isFoulerDraftComplete,
  opponentOf,
} from "./foulRecordingUtils";
import { getRimPosition, isCourtClickThreePointer } from "./courtThreePoint";
import type {
  ActiveTurnoverFlow,
  TurnoverFlowDraft,
  TurnoverTypeId,
} from "./turnoverRecordingUtils";
import {
  initialTurnoverFlowFromPanel,
  turnoverFlowBack,
  turnoverTypeLabel,
} from "./turnoverRecordingUtils";
import type { OnCourtSlots, TeamLineup } from "./substitutionLineupUtils";
import {
  cloneLineup,
  compactOnCourt,
  DEFAULT_TEAM_LINEUP,
  diffLineupOnCourt,
  formatSubstitutionDiff,
  fullRoster,
  LINEUP_SLOTS,
  lineupIsComplete,
  swapPlayers,
} from "./substitutionLineupUtils";
import LogEditorModal from "./components/LogEditorModal";
import {
  lastClockEvent,
  readClockAnchor,
  restoreClock,
  writeClockAnchor,
} from "../../features/statdash/clockAnchor";
import {
  actionTitle,
  buildCorrectedPayload,
  toCommandPayload,
  canSwapBack,
  describeUndo,
  draftPoints,
  editScoreDelta,
  isDraftDirty,
  planUndo,
  pointsOf,
  shotValueFor,
  substitutionEditOptions,
  syncStateFor,
  type CorrectionContext,
} from "./logEdit/logEditModel";
import {
  readGameSetupOrientation,
  readGameSetupOrientationForSession,
  writeGameSetupOrientation,
} from "../gameSetupOrientation";
import {
  clearJumpBallWinnerTeamId,
  readJumpBallWinnerTeamId,
} from "../jumpBallWinner";
import { buildGameLogFromEvents } from "./gameLogReplay";
import {
  commandsApi,
  createSessionSseClient,
  projectionsApi,
  sessionsApi,
  type CommandAcceptedResponse,
  type SessionStateSnapshot,
  type RealtimeSessionMessage,
} from "../../services/statdash";
import { useMatch } from "../../api/hooks";
import {
  readStoredExpectedVersion,
  readStoredSessionContext,
  readStoredLineups,
  writeStoredExpectedVersion,
  writeStoredLineups,
} from "../../features/statdash/sessionContextStorage";
import { generateIdempotencyKey } from "../../features/statdash/utils";
import { useEventQueue } from "../../features/statdash/eventQueue/useEventQueue";
import type { QueuedEvent } from "../../features/statdash/eventQueue/types";

const DEFAULT_HOME = "TEAM 1";
const DEFAULT_AWAY = "TEAM 2";
const QUARTER_DURATION_SEC = 10 * 60;
const DEFAULT_OVERTIME_MINUTES = 5;
/**
 * Upper bound for manual clock adjustment (seconds). Matches the backend's
 * `ClockCommandDto.clockSecondsRemaining` cap (`@Max(720)`) — anything past this would be
 * accepted locally but silently rejected (400) when the `clock` command is sent.
 */
const MAX_TIMER_SECONDS = 12 * 60;
/**
 * `ClockCommandDto.period` on the backend caps at 10 (@Max(10)) — 4 regulation quarters
 * leaves room for 6 overtimes. A 7th OT would fail the clock command's validation; vanishingly
 * rare in practice, but worth knowing if it ever comes up.
 */
const MAX_PERIOD = 10;

type ShotFlowState = "idle" | ActiveShotFlow;
type FoulFlowState = "idle" | ActiveFoulFlow;
type TurnoverFlowState = "idle" | ActiveTurnoverFlow;

function newLogId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const StatDash: React.FC = () => {
  const navigate = useNavigate();
  const initialOrientation = useMemo(() => readGameSetupOrientation(), []);
  const [homeOnLeft, setHomeOnLeft] = useState(initialOrientation.homeOnLeft);
  const [homeAttacksLeft, setHomeAttacksLeft] = useState(
    initialOrientation.homeAttacksLeft,
  );
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
  const gameLogRef = useRef<GameLogEntry[]>([]);
  gameLogRef.current = gameLog;
  const [shotFlow, setShotFlow] = useState<ShotFlowState>("idle");
  const shotFlowRef = useRef<ShotFlowState>("idle");
  shotFlowRef.current = shotFlow;

  const [foulFlow, setFoulFlow] = useState<FoulFlowState>("idle");
  const foulFlowRef = useRef<FoulFlowState>("idle");
  foulFlowRef.current = foulFlow;
  /** Technical fouls per player this game, keyed `${side}:${jersey}` — 2 means ejection. */
  const technicalFoulTallyRef = useRef<Map<string, number>>(new Map());
  /** First FT command's localId for the current sequence — the FT assist log row shares it. */
  const ftFirstLocalIdRef = useRef<string | null>(null);
  /** localId of the foul that's currently awarding free throws — used to look up its
   * backendEventId in gameLog so each FT command can carry it as parentEventId, letting
   * a later reversal of the foul cascade to reverse its free throws too (Backend Gap #15). */
  const currentFoulLocalIdRef = useRef<string | null>(null);
  /** Player who just picked up their 2nd technical; triggers notice + sub modal once the foul flow ends. */
  const [pendingEjection, setPendingEjection] = useState<{
    side: TeamSide;
    jersey: number;
  } | null>(null);
  const [ejectionNotice, setEjectionNotice] = useState<string | null>(null);

  const [turnoverFlow, setTurnoverFlow] = useState<TurnoverFlowState>("idle");
  const turnoverFlowRef = useRef<TurnoverFlowState>("idle");
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
  // Backend GameSession.status (PENDING/IN_PROGRESS/PAUSED/COMPLETED/CANCELLED) — distinct from
  // `isRunning`, which only tracks the local clock. Drives the Pause/Resume/Finish/Cancel menu.
  const [sessionStatus, setSessionStatus] = useState<string>("PENDING");

  // The clock is remembered on this device at every change, so a reload, reconnect or resync brings
  // back the clock the statistician left (stopped, running, or paused) instead of guessing from the
  // session status. Read through refs so saving never depends on a value from an older render.
  const clockRefs = useRef({ isRunning: false, seconds: QUARTER_DURATION_SEC, quarter: 1, status: "PENDING" });
  const saveClockAnchor = useCallback((secondsOverride?: number) => {
    const context = readStoredSessionContext();
    if (!context) return;
    const c = clockRefs.current;
    writeClockAnchor({
      sessionId: context.sessionId,
      isRunning: c.isRunning,
      seconds: secondsOverride ?? c.seconds,
      period: c.quarter,
      status: c.status,
      at: Date.now(),
    });
  }, []);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancellingSession, setIsCancellingSession] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeReconnecting, setRealtimeReconnecting] = useState(false);

  const [homeLineup, setHomeLineup] = useState<TeamLineup>(() => {
    const saved = readStoredLineups();
    if (saved) {
      console.log("[StatDash] Lineup loaded from sessionStorage:", {
        home: { onCourt: saved.home.onCourt, bench: saved.home.bench },
        away: { onCourt: saved.away.onCourt, bench: saved.away.bench },
      });
      return cloneLineup(saved.home);
    }
    console.warn(
      "[StatDash] No saved lineup found — using DEFAULT_TEAM_LINEUP",
    );
    return cloneLineup(DEFAULT_TEAM_LINEUP);
  });
  const [awayLineup, setAwayLineup] = useState<TeamLineup>(() => {
    const saved = readStoredLineups();
    return saved ? cloneLineup(saved.away) : cloneLineup(DEFAULT_TEAM_LINEUP);
  });

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subDraftHome, setSubDraftHome] = useState<TeamLineup>(() =>
    cloneLineup(DEFAULT_TEAM_LINEUP),
  );
  const [subDraftAway, setSubDraftAway] = useState<TeamLineup>(() =>
    cloneLineup(DEFAULT_TEAM_LINEUP),
  );
  const subModalOpenRef = useRef(false);
  subModalOpenRef.current = subModalOpen;

  const [foulPickerOpen, setFoulPickerOpen] = useState(false);
  const foulPickerOpenRef = useRef(false);
  foulPickerOpenRef.current = foulPickerOpen;
  const [activeDrawer, setActiveDrawer] = useState<"left" | "right" | null>(
    null,
  );
  const [quarterBreakModalOpen, setQuarterBreakModalOpen] = useState(false);
  const [quarterBreakPending, setQuarterBreakPending] = useState(false);
  /** After "Not yet" on quarter-ended modal: show yellow Finish to reopen that modal. */
  const [quarterEndAwaitingFinish, setQuarterEndAwaitingFinish] =
    useState(false);
  // Overtime: prompted whenever regulation (or a prior OT) ends tied, however many times
  // that takes. Length defaults to 5 minutes but is editable per-overtime in the modal.
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [overtimeMinutesDraft, setOvertimeMinutesDraft] = useState(
    DEFAULT_OVERTIME_MINUTES,
  );
  const [editingLog, setEditingLog] = useState<GameLogEntry | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  /** The draft as it was when the editor opened, so Save can tell whether anything changed. */
  const [editInitial, setEditInitial] = useState<Record<string, unknown>>({});
  const [switchSidesOpen, setSwitchSidesOpen] = useState(false);
  const [startersModalOpen, setStartersModalOpen] = useState(false);

  const homeActiveList = useMemo(
    () => compactOnCourt(homeLineup),
    [homeLineup],
  );
  const awayActiveList = useMemo(
    () => compactOnCourt(awayLineup),
    [awayLineup],
  );

  const homePanelNumbers = useMemo(
    () => [...homeActiveList].sort((a, b) => a - b),
    [homeActiveList],
  );

  const awayPanelNumbers = useMemo(
    () => [...awayActiveList].sort((a, b) => a - b),
    [awayActiveList],
  );
  const homeRosterList = useMemo(() => fullRoster(homeLineup), [homeLineup]);
  const awayRosterList = useMemo(() => fullRoster(awayLineup), [awayLineup]);

  useEffect(() => {
    console.log("[StatDash] Panel numbers updated:", {
      home: { onCourt: homePanelNumbers, bench: homeLineup.bench },
      away: { onCourt: awayPanelNumbers, bench: awayLineup.bench },
    });
  }, [homePanelNumbers, awayPanelNumbers, homeLineup.bench, awayLineup.bench]);

  useEffect(() => {
    if (!matchForNamesQuery.data) return;
    const homeTeamPlayers = (
      matchForNamesQuery.data.homeTeam?.playerTeams ?? []
    ).map((pt) => ({
      jersey: pt.jerseyNumber,
      player: pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : null,
    }));
    const awayTeamPlayers = (
      matchForNamesQuery.data.awayTeam?.playerTeams ?? []
    ).map((pt) => ({
      jersey: pt.jerseyNumber,
      player: pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : null,
    }));
    console.log("[StatDash] Match roster from API:", {
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

  clockRefs.current = { isRunning, seconds: timerSeconds, quarter, status: sessionStatus };
  useEffect(() => {
    if (isBootstrapping) return;
    saveClockAnchor();
  }, [isBootstrapping, isRunning, quarter, sessionStatus, saveClockAnchor]);

  const clockLabel = formatClock(timerSeconds);
  const periodLabel = formatPeriodLabel(quarter);

  const appendLog = useCallback((row: Omit<GameLogEntry, "id">) => {
    // Stamp who was actually on the court for each team at the moment this play
    // happened — the log editor uses this to restrict player pickers (you can't
    // have shot/rebounded/stolen the ball while sitting on the bench). Read via
    // ref so appendLog's identity stays stable across renders.
    const onCourt = activeRosterRef.current;
    setGameLog((prev) => [
      {
        id: newLogId(),
        ...row,
        meta: {
          ...(row.meta ?? {}),
          onCourtHome: onCourt.home,
          onCourtAway: onCourt.away,
        },
      },
      ...prev,
    ]);
  }, []);
  const latestVersionRef = useRef<number>(readStoredExpectedVersion());
  // The session version only ever goes up, but a version read from GET /state can be OLDER than
  // one we already got back from a command: the backend serves /state from a 30-second snapshot
  // cache, and starting/pausing a session neither bumps the version nor clears that cache. Taking
  // such a read at face value moved our version backwards, so the next command was sent stale and
  // rejected. Anything that isn't a direct answer to one of our own commands goes through here.
  const raiseKnownVersion = useCallback((version: number) => {
    if (version <= latestVersionRef.current) return;
    latestVersionRef.current = version;
    writeStoredExpectedVersion(version);
  }, []);
  const pendingCountRef = useRef(0);
  const queueRef = useRef<QueuedEvent[]>([]);
  const markersRestoredRef = useRef(false);
  const gameLogRestoredRef = useRef(false);
  const lineupRestoredRef = useRef(false);
  const lineupForceStartersCheckedRef = useRef(false);
  const lineupPushedRef = useRef(false);
  const recentEventsRef = useRef<SessionStateSnapshot["recentEvents"]>([]);
  const activeLineupsRef =
    useRef<SessionStateSnapshot["activeLineups"]>(undefined);

  const applyAuthoritativeState = useCallback(
    (
      state: SessionStateSnapshot,
      opts?: {
        trustScore?: boolean;
        /** Take the quarter and clock from the server. Off for background resyncs: this device's
         * clock is the live one, and the server's copy can be stale (its /state is cached). */
        applyClock?: boolean;
      },
    ) => {
      const trustScore = opts?.trustScore ?? true;
      const applyClock = opts?.applyClock ?? true;
      if (trustScore) {
        setHomeScore(state.score.home);
        setAwayScore(state.score.away);
      } else {
        // The backend's score projection can lag a beat behind the version bump
        // (observed directly: a made free throw's response didn't reflect the +1
        // until the *next* unrelated request). A background realtime resync that
        // lands in that window would otherwise blindly overwrite a correct,
        // already-displayed score with a stale lower one — visible as "the score
        // reset". Never regress it here; a real correction/reversal always calls
        // this with the default trustScore (true) and must be allowed to lower it.
        setHomeScore((prev) => Math.max(prev, state.score.home));
        setAwayScore((prev) => Math.max(prev, state.score.away));
      }
      if (applyClock) {
        setQuarter(state.quarter);
        setTimerSeconds(state.clockSecondsRemaining);
      }
      // "In progress" only means the game has started — the statistician can stop the clock at a
      // dead ball without the session leaving it. So a server state can stop the clock (game
      // paused, finished, not started) but must never start it: whether it is running is decided
      // by the clock's own start/stop, restored from what was remembered (see restoreClock).
      if (state.status !== "IN_PROGRESS") setIsRunning(false);
      setSessionStatus(state.status);
    },
    [],
  );

  const getTeamIdForSide = useCallback((side: TeamSide): string => {
    const context = readStoredSessionContext();
    if (side === "home") return context?.homeTeamId ?? "home_team";
    return context?.awayTeamId ?? "away_team";
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

  const getPlayerId = useCallback(
    (side: TeamSide, jersey: number): string => {
      const map = side === "home" ? homePlayerIdByJersey : awayPlayerIdByJersey;
      // Fall back to synthetic ID if match data hasn't loaded yet
      return map.get(jersey) ?? `${getTeamIdForSide(side)}_${jersey}`;
    },
    [homePlayerIdByJersey, awayPlayerIdByJersey, getTeamIdForSide],
  );

  // Real player UUID -> {side, jersey}, the reverse of the maps above. Used to
  // reconstruct game log rows from backend GameEvent payloads on reconnect
  // (see gameLogReplay.ts and the bootstrap effect below).
  const playerRefByPlayerId = useMemo(() => {
    const map = new Map<string, { side: TeamSide; jersey: number }>();
    for (const pt of matchForNamesQuery.data?.homeTeam?.playerTeams ?? []) {
      if (pt.player?.id && pt.jerseyNumber != null) {
        map.set(pt.player.id, { side: "home", jersey: pt.jerseyNumber });
      }
    }
    for (const pt of matchForNamesQuery.data?.awayTeam?.playerTeams ?? []) {
      if (pt.player?.id && pt.jerseyNumber != null) {
        map.set(pt.player.id, { side: "away", jersey: pt.jerseyNumber });
      }
    }
    return map;
  }, [matchForNamesQuery.data]);

  const resolvePlayerRef = useCallback(
    (playerId: unknown): { side: TeamSide; jersey: number } | null => {
      if (typeof playerId !== "string") return null;
      return playerRefByPlayerId.get(playerId) ?? null;
    },
    [playerRefByPlayerId],
  );

  const getQueueRef = useRef<() => QueuedEvent[]>(() => []);
  const {
    enqueue,
    queue,
    pendingCount,
    failedCount,
    isOnline,
    retryFailed,
    discardEvent,
    updateEvent,
    getQueue,
  } = useEventQueue({
      getLatestVersion: () => latestVersionRef.current,
      onVersionObserved: raiseKnownVersion,
      onCommandAccepted: (event, response) => {
        writeStoredExpectedVersion(response.version);
        latestVersionRef.current = response.version;
        // Commands in this queue are processed strictly in order, but the user can tap several
        // actions (e.g. Made FT, Miss FT, Made FT) before any of their network responses land.
        // Each response only reflects the backend's state as of *that* command, which can be
        // briefly behind an already-applied optimistic update from a later tap — so a response
        // must not drag the displayed score backwards while more is still on its way.
        // Once nothing else is waiting to be sent, this response IS the server's current score,
        // so take it as-is — that lets an undo or edit legitimately lower the score and corrects
        // any drift in the local arithmetic. While other plays are still in flight it only ever
        // moves up, because it can be behind plays already applied locally.
        const othersWaiting = getQueueRef.current().some(
          (q) => q.localId !== event.localId && (q.status === "pending" || q.status === "inflight"),
        );
        if (othersWaiting) {
          setHomeScore((prev) => Math.max(prev, response.score.home));
          setAwayScore((prev) => Math.max(prev, response.score.away));
        } else {
          setHomeScore(response.score.home);
          setAwayScore(response.score.away);
        }
        if (pendingCountRef.current === 0) {
          setSyncNotice(null);
        }
        // Link log entries to the real backend event ID so the edit modal can call correctEvent
        const backendEventId = response.emittedEvents?.[0]?.id;
        if (backendEventId && event.localId) {
          setGameLog((prev) =>
            prev.map((entry) =>
              entry.localId === event.localId
                ? { ...entry, backendEventId }
                : entry,
            ),
          );
        }
      },
      onCommandFailed: (_event, error) => {
        if (error instanceof Error) {
          setSyncNotice(error.message);
        }
      },
    });
  getQueueRef.current = getQueue;

  useEffect(() => {
    if (matchForNamesQuery.data?.homeTeam?.name)
      setHomeName(matchForNamesQuery.data.homeTeam.name);
    if (matchForNamesQuery.data?.awayTeam?.name)
      setAwayName(matchForNamesQuery.data.awayTeam.name);
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

  const getPlayerLabel = useCallback(
    (side: TeamSide | null, jersey: number): string => {
      if (side === null) return `#${jersey}`;
      const name = (
        side === "home" ? homeRosterByJersey : awayRosterByJersey
      ).get(jersey);
      return name ? `#${jersey} ${name}` : `#${jersey}`;
    },
    [homeRosterByJersey, awayRosterByJersey],
  );

  // Full registered roster from match data — used for the edge drawers so every
  // player shows regardless of which jersey numbers are currently in the lineup state.
  // Set deduplicates in case the API returns duplicate PlayerTeam records (Gap #7).
  const homeMatchRosterNumbers = useMemo(
    () =>
      [
        ...new Set(
          (matchForNamesQuery.data?.homeTeam?.playerTeams ?? [])
            .filter((pt) => pt.jerseyNumber != null)
            .map((pt) => pt.jerseyNumber as number),
        ),
      ].sort((a, b) => a - b),
    [matchForNamesQuery.data],
  );
  const awayMatchRosterNumbers = useMemo(
    () =>
      [
        ...new Set(
          (matchForNamesQuery.data?.awayTeam?.playerTeams ?? [])
            .filter((pt) => pt.jerseyNumber != null)
            .map((pt) => pt.jerseyNumber as number),
        ),
      ].sort((a, b) => a - b),
    [matchForNamesQuery.data],
  );

  // Full team roster for the in-game Starters modal — all registered players so the
  // statistician can re-select starters on resume without being limited to what's in
  // the current (possibly defaulted) lineup.
  const homePlayersForStartersModal = useMemo(() => {
    const roster = matchForNamesQuery.data?.homeTeam?.playerTeams ?? [];
    return roster
      .filter((pt) => pt.player)
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchForNamesQuery.data]);
  const awayPlayersForStartersModal = useMemo(() => {
    const roster = matchForNamesQuery.data?.awayTeam?.playerTeams ?? [];
    return roster
      .filter((pt) => pt.player)
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchForNamesQuery.data]);

  useEffect(() => {
    pendingCountRef.current = pendingCount;
    queueRef.current = queue;
  }, [pendingCount, queue]);

  const commitEventCommand = useCallback(
    async (
      commandType: string,
      payload: Record<string, unknown>,
      options?: { stampClock?: boolean; parentEventId?: string; parentLocalId?: string },
    ): Promise<(CommandAcceptedResponse & { localId: string }) | null> => {
      const context = readStoredSessionContext();
      if (!context) {
        navigate("/match-key", { replace: true });
        return null;
      }
      const idempotencyKey = generateIdempotencyKey();
      // expectedVersion is NOT pre-computed here: the backend bumps the session version by
      // however many events a command emits (e.g. a made free throw with an assist emits
      // 2, not 1), so a value guessed at enqueue time — before earlier queued commands have
      // even been sent — inevitably drifts. The queue's drain resolves the real value from
      // the last *confirmed* version at the moment each command is actually sent instead
      // (see drain.ts's resolveExpectedVersion and useEventQueue's getLatestVersion). This
      // field is carried on the queued event only as an initial/informational value.

      // Every event carries when in the game it happened — otherwise the backend has no
      // way to reconstruct "what quarter/clock was this at" after the fact (see Backend
      // Gap #6 and #11 in docs/BACKEND_GAPS.md). The `clock` command sets these as its own
      // target values with different meaning (where the clock is going), so it's excluded.
      // The pre-game jump ball also opts out (stampClock: false, see below): it always
      // happens at Q1/10:00 before the clock has moved, so the stamp is pure noise there —
      // and dropping it means that one command's payload happens to already match the
      // live backend's JumpBallCommandDto exactly (see docs/BACKEND_GAPS.md Gap #16).
      const stampClock = options?.stampClock ?? true;
      const payloadWithClock =
        commandType === "clock" || !stampClock
          ? payload
          : {
              period: quarter,
              clockSecondsRemaining: timerSeconds,
              ...payload,
            };

      enqueue({
        sessionId: context.sessionId,
        commandType,
        payload: payloadWithClock,
        expectedVersion: latestVersionRef.current,
        localId: idempotencyKey,
        parentEventId: options?.parentEventId,
        parentLocalId: options?.parentLocalId,
      });

      return {
        sessionId: context.sessionId,
        version: latestVersionRef.current,
        score: { home: homeScore, away: awayScore },
        emittedEvents: [],
        localId: idempotencyKey,
      };
    },
    [enqueue, homeScore, awayScore, navigate, quarter, timerSeconds],
  );
  // Bootstrap (below) must not re-run every time commitEventCommand's identity
  // changes — it changes every second while the clock is running (timerSeconds
  // is a dep), which was re-triggering the bootstrap fetch and flickering the
  // "Syncing game session…" status line on and off. Mirror it into a ref instead
  // so bootstrap always calls the latest version without depending on it.
  const commitEventCommandRef = useRef(commitEventCommand);
  commitEventCommandRef.current = commitEventCommand;

  const onTick = useCallback(() => {
    setTimerSeconds((s) => Math.max(0, s - 1));
  }, []);

  // End-of-period flow: show CTA, then arm the next period without auto-start. Regulation
  // quarters always prompt for the next quarter. Once regulation is over (or a previous
  // overtime just ended), a tied score prompts for another overtime — however many it takes
  // — and an untied score prompts to finish the game instead (there must always be a next
  // step here, otherwise the game can never be closed out).
  useEffect(() => {
    if (!isRunning) return;
    if (timerSeconds !== 0) return;
    setIsRunning(false);
    if (quarter < REGULATION_QUARTERS) {
      setQuarterBreakPending(true);
      setQuarterBreakModalOpen(true);
      setQuarterEndAwaitingFinish(false);
      return;
    }
    if (homeScore === awayScore) {
      setOvertimeModalOpen(true);
      setQuarterEndAwaitingFinish(false);
      return;
    }
    setFinishConfirmOpen(true);
    setQuarterEndAwaitingFinish(false);
  }, [isRunning, timerSeconds, quarter, homeScore, awayScore]);

  // Jump-ball page -> StatDash: prompt before starting the game clock.
  useEffect(() => {
    const bootstrap = async () => {
      const context = readStoredSessionContext();
      if (!context) {
        navigate("/match-key", { replace: true });
        return;
      }
      setIsBootstrapping(true);
      setBootError(null);
      try {
        const snapshot = await sessionsApi.bootstrapSession({
          sessionId: context.sessionId,
        });
        applyAuthoritativeState(snapshot);
        // Bring back the clock exactly as it was left: stopped stays stopped, running keeps
        // counting, and a just-paused game stays paused even if the server's cached status lags.
        const restoredClock = restoreClock({
          serverStatus: snapshot.status,
          serverSeconds: snapshot.clockSecondsRemaining,
          anchor: readClockAnchor(context.sessionId),
          serverClockEvent: lastClockEvent(snapshot.recentEvents),
        });
        setIsRunning(restoredClock.isRunning);
        setTimerSeconds(restoredClock.seconds);
        setSessionStatus(restoredClock.status as typeof snapshot.status);
        writeStoredExpectedVersion(snapshot.version);
        latestVersionRef.current = snapshot.version;
        recentEventsRef.current = snapshot.recentEvents ?? [];
        activeLineupsRef.current = snapshot.activeLineups;
        // Court orientation (Backend Gap #17). This tab's own saved choice wins — it is what the
        // statistician actually picked — and the backend is brought in line with it if it differs
        // (this also heals sessions created before the backend stored orientation, which sit at
        // the true/true default). With nothing saved for this session (new device, cleared
        // storage) the backend's value is adopted instead.
        const localOrientation = readGameSetupOrientationForSession(
          snapshot.sessionId,
        );
        if (localOrientation) {
          if (
            localOrientation.homeOnLeft !== snapshot.orientation.homeOnLeft ||
            localOrientation.homeAttacksLeft !==
              snapshot.orientation.homeAttacksLeft
          ) {
            void sessionsApi
              .updateOrientation(snapshot.sessionId, localOrientation)
              .catch(() => undefined);
          }
        } else {
          setHomeOnLeft(snapshot.orientation.homeOnLeft);
          setHomeAttacksLeft(snapshot.orientation.homeAttacksLeft);
          writeGameSetupOrientation(snapshot.orientation, snapshot.sessionId);
        }
        const winningTeamId = readJumpBallWinnerTeamId();
        if (winningTeamId && snapshot.status !== "IN_PROGRESS") {
          // The pre-game JumpBall page only stored this locally before — now it's sent
          // through the same event pipeline as the in-game re-jump-ball flow, so the
          // jump ball result actually reaches the backend (and survives reconnect via
          // recentEvents replay below) instead of being thrown away on navigation.
          // stampClock: false — this always happens at Q1/10:00, before the clock has
          // moved, so there's no real "when" to record (unlike an in-game held-ball
          // re-jump, which can happen at any point and keeps its timestamp).
          void commitEventCommandRef.current(
            "jump_ball",
            { winningTeamId },
            { stampClock: false },
          );
          setStartGamePromptOpen(true);
          setQuarterBreakPending(false);
        }
        clearJumpBallWinnerTeamId();
      } catch (error) {
        setBootError(
          error instanceof Error
            ? error.message
            : "Failed to bootstrap game session",
        );
      } finally {
        setIsBootstrapping(false);
      }
    };
    void bootstrap();
  }, [applyAuthoritativeState, navigate]);

  // After bootstrap, restore shot markers from the server-side shot chart projection —
  // but only the current period's shots, matching the same "court overlay shows this
  // period only" rule that handleQuarterBreakConfirm/handleOvertimeConfirm enforce during
  // a live, uninterrupted session (they clear the overlay on every period change). Without
  // this filter, reconnecting mid-game would dump every shot from every earlier quarter
  // onto the court at once. Runs once — the ref guard prevents re-runs if
  // homeTeamColor/awayTeamColor update later.
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
          .filter((s) => s.x != null && s.y != null && s.period === quarter)
          .map((s) => ({
            nx: s.x as number,
            ny: s.y as number,
            color:
              s.teamId === context.homeTeamId ? homeTeamColor : awayTeamColor,
            kind: s.result === "made" ? ("made" as const) : ("missed" as const),
          }));
        if (markers.length > 0) setCourtShotMarkers(markers);
      } catch {
        // Court markers are cosmetic — silently ignore fetch failures on reconnect
      }
    })();
  }, [isBootstrapping, homeTeamColor, awayTeamColor, quarter]);

  // After bootstrap, rebuild the play-by-play log from the backend's own event history
  // (snapshot.recentEvents, stashed in recentEventsRef during the bootstrap effect above)
  // instead of leaving it blank on reconnect. Waits for match roster data so player/team
  // names resolve correctly; runs once via the ref guard. See docs/BACKEND_GAPS.md Gap #11 —
  // this is the frontend half; entries show "—" for period/clock until the backend whitelists
  // those fields on every command DTO.
  useEffect(() => {
    if (isBootstrapping) return;
    if (gameLogRestoredRef.current) return;
    if (!matchForNamesQuery.data) return;
    gameLogRestoredRef.current = true;
    const events = recentEventsRef.current;
    if (!events || events.length === 0) return;
    const context = readStoredSessionContext();
    const replayed = buildGameLogFromEvents(events, {
      homeTeamId: context?.homeTeamId,
      awayTeamId: context?.awayTeamId,
      homeName: matchForNamesQuery.data.homeTeam?.name ?? homeName,
      awayName: matchForNamesQuery.data.awayTeam?.name ?? awayName,
      resolvePlayer: resolvePlayerRef,
      getPlayerLabel,
    });
    if (replayed.length > 0) {
      setGameLog((prev) => (prev.length > 0 ? prev : replayed));
    }

    // Rebuild the 2-technicals-=-ejection tally from history too — it's only ever
    // held in `technicalFoulTallyRef` (not even localStorage), so without this a
    // refresh would forget a player already had 1 technical foul and silently miss
    // the ejection prompt on their 2nd. Doesn't reopen the ejection modal on load —
    // that could re-surface something the statistician already handled before
    // reconnecting — it only restores the count so the *next* technical (if any)
    // is judged correctly. Same 25-event window caveat as the game log above.
    for (const event of events) {
      if (event.eventType !== "foul") continue;
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      if (payload.foulType !== "technical") continue;
      const foulerRef = resolvePlayerRef(payload.foulerPlayerId);
      if (!foulerRef) continue;
      const key = `${foulerRef.side}:${foulerRef.jersey}`;
      technicalFoulTallyRef.current.set(
        key,
        (technicalFoulTallyRef.current.get(key) ?? 0) + 1,
      );
    }
  }, [
    isBootstrapping,
    matchForNamesQuery.data,
    homeName,
    awayName,
    resolvePlayerRef,
    getPlayerLabel,
  ]);

  // After bootstrap, prefer the backend's own lineup snapshot (snapshot.activeLineups,
  // stashed in activeLineupsRef) over whatever localStorage has for this browser — the
  // backend is authoritative once it's populated, and is the only thing that can be
  // right on a brand-new device. Currently a no-op in practice: the backend never writes
  // a LineupState row yet (docs/BACKEND_GAPS.md Gap #10), so activeLineups is always null
  // and this effect finds nothing to apply — it starts working the moment that ships,
  // with no further frontend change needed.
  useEffect(() => {
    if (isBootstrapping) return;
    if (lineupRestoredRef.current) return;
    if (!matchForNamesQuery.data) return;
    lineupRestoredRef.current = true;
    const active = activeLineupsRef.current;
    if (!active?.homeLineup || !active?.awayLineup) return;

    const buildLineup = (
      playerIds: unknown,
      rosterNumbers: number[],
    ): TeamLineup | null => {
      if (!Array.isArray(playerIds)) return null;
      const onCourtJerseys = playerIds
        .map((id) => resolvePlayerRef(id)?.jersey)
        .filter((j): j is number => typeof j === "number");
      if (onCourtJerseys.length === 0) return null;
      const onCourt = Array.from(
        { length: LINEUP_SLOTS },
        (_, i) => onCourtJerseys[i] ?? null,
      ) as OnCourtSlots;
      const bench = rosterNumbers.filter((j) => !onCourtJerseys.includes(j));
      return { onCourt, bench };
    };

    const restoredHome = buildLineup(active.homeLineup, homeMatchRosterNumbers);
    const restoredAway = buildLineup(active.awayLineup, awayMatchRosterNumbers);
    if (restoredHome) setHomeLineup(restoredHome);
    if (restoredAway) setAwayLineup(restoredAway);
  }, [
    isBootstrapping,
    matchForNamesQuery.data,
    homeMatchRosterNumbers,
    awayMatchRosterNumbers,
    resolvePlayerRef,
  ]);

  // Bug #45: with no real lineup available from either source above, `homeLineup`/
  // `awayLineup` are still sitting at their initial-state fallback — the hardcoded,
  // fake `DEFAULT_TEAM_LINEUP` (jerseys 1-5, no real player IDs behind them). Playing
  // on through that silently fabricates bogus player IDs the backend correctly
  // rejects the moment anything (e.g. a substitution) tries to use one. Force the
  // statistician through Starters instead of letting that happen.
  //
  // Only for a session that hasn't started yet (PENDING) — Starters' "Confirm" always
  // continues on to ChooseSides -> JumpBall (see Bug #11), so redirecting an
  // already-IN_PROGRESS/PAUSED game here would re-run the whole pre-game wizard on
  // top of a live game (re-flip sides, re-record a jump ball, etc.), which is worse
  // than the bug it'd fix. A resumed game with no lineup is the separate, existing
  // Bug #14 (lineup not persisted across resume) — left alone here.
  //
  // Runs once, after both potential real-lineup sources (sessionStorage and, once
  // Gap #10 ships, the backend) have had their chance to populate real data.
  useEffect(() => {
    if (isBootstrapping) return;
    if (lineupForceStartersCheckedRef.current) return;
    lineupForceStartersCheckedRef.current = true;
    if (sessionStatus !== "PENDING") return;
    const hasLocalLineup = readStoredLineups() !== null;
    const active = activeLineupsRef.current;
    const hasServerLineup = Boolean(active?.homeLineup && active?.awayLineup);
    if (!hasLocalLineup && !hasServerLineup) {
      navigate("/starters", { replace: true });
    }
  }, [isBootstrapping, navigate, sessionStatus]);

  // Backend Gap #19: push both teams' starting five to the backend as soon as we land
  // on a PENDING session with a real local lineup but nothing on the backend yet.
  // Without this, the backend's first-ever LineupState row for a session only gets
  // created by whichever team happens to substitute first (substitution commands always
  // carry the full resulting lineup — see handleSubstitutionFinish below). Backend Gap
  // #21's substitution validation then rejects every *other* team's next substitution as
  // "player not on court", because the snapshot it validates against never had that
  // team's real starters in it. Sending both teams' starters up front — before either
  // team's first substitution — means that snapshot is complete from the start.
  useEffect(() => {
    if (isBootstrapping) return;
    if (lineupPushedRef.current) return;
    if (sessionStatus !== "PENDING") return;
    const active = activeLineupsRef.current;
    const hasServerLineup = Boolean(active?.homeLineup && active?.awayLineup);
    if (hasServerLineup) {
      lineupPushedRef.current = true;
      return;
    }
    if (readStoredLineups() === null) return; // nothing real to push yet — wait for Starters
    if (!lineupIsComplete(homeLineup) || !lineupIsComplete(awayLineup)) return;
    lineupPushedRef.current = true;
    void commitEventCommand("substitution", {
      teamId: getTeamIdForSide("home"),
      homeLineup: compactOnCourt(homeLineup).map((jersey) =>
        getPlayerId("home", jersey),
      ),
      awayLineup: compactOnCourt(awayLineup).map((jersey) =>
        getPlayerId("away", jersey),
      ),
    });
  }, [
    isBootstrapping,
    sessionStatus,
    homeLineup,
    awayLineup,
    getPlayerId,
    getTeamIdForSide,
    commitEventCommand,
  ]);

  useEffect(() => {
    const context = readStoredSessionContext();
    if (!context) return;

    const applyRealtimeMessage = async (message: RealtimeSessionMessage) => {
      if (message.sessionId !== context.sessionId) return;
      if (message.state.version <= latestVersionRef.current) return;
      const hasActiveDraft =
        shotFlowRef.current !== "idle" ||
        foulFlowRef.current !== "idle" ||
        turnoverFlowRef.current !== "idle" ||
        subModalOpenRef.current ||
        pendingCountRef.current > 0 ||
        queueRef.current.some((event) => event.status === "inflight");

      if (hasActiveDraft) {
        setSyncNotice("Live update received. Finish this step to auto-sync.");
        return;
      }

      try {
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest, { trustScore: false, applyClock: false });
        raiseKnownVersion(latest.version);
        setSyncNotice(null);
      } catch {
        setSyncNotice("Realtime sync update failed. Pull to refresh state.");
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
              applyAuthoritativeState(latest, { trustScore: false, applyClock: false });
              raiseKnownVersion(latest.version);
            }
          } catch {
            setSyncNotice(
              "Connected but could not refresh latest session state.",
            );
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
      navigate("/match-key", { replace: true });
      return;
    }
    setIsStartingGame(true);
    try {
      const started = await sessionsApi.startSession(context.sessionId);
      const latest = await sessionsApi.getSessionState(context.sessionId);
      raiseKnownVersion(latest.version);
      // Status comes from the start call itself, not the (cached) state read.
      applyAuthoritativeState(
        { ...latest, status: started.status as typeof latest.status },
        { applyClock: false },
      );
      setIsRunning(true);
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

  // Pause/Resume/Finish/Cancel all change the backend's GameSession.status (distinct from the
  // local clock's isRunning). Resume reuses /start — the backend only forbids it from a
  // COMPLETED/CANCELLED session, so it works from PENDING or PAUSED alike.
  const handlePauseResume = useCallback(async () => {
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    setIsTogglingPause(true);
    try {
      // The status comes from the pause/start call itself. Re-reading it from GET /state would
      // return the backend's cached snapshot, which isn't cleared by a pause and still says the
      // game is in progress — flipping the screen straight back to "running".
      const updated =
        sessionStatus === "PAUSED"
          ? await sessionsApi.startSession(context.sessionId)
          : await sessionsApi.pauseSession(context.sessionId);
      const latest = await sessionsApi.getSessionState(context.sessionId);
      raiseKnownVersion(latest.version);
      applyAuthoritativeState(
        { ...latest, status: updated.status as typeof latest.status },
        { applyClock: false },
      );
      // Resuming runs the clock again; pausing stops it.
      setIsRunning(updated.status === "IN_PROGRESS");
    } catch (error) {
      setSyncNotice(
        error instanceof Error
          ? error.message
          : "Failed to update session status",
      );
    } finally {
      setIsTogglingPause(false);
    }
  }, [applyAuthoritativeState, navigate, sessionStatus]);

  const handleFinishMatchConfirm = useCallback(async () => {
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    setIsFinishingSession(true);
    try {
      await sessionsApi.completeSession(context.sessionId);
      setFinishConfirmOpen(false);
      navigate("/match-key", { replace: true });
    } catch (error) {
      setSyncNotice(
        error instanceof Error ? error.message : "Failed to finish match",
      );
    } finally {
      setIsFinishingSession(false);
    }
  }, [navigate]);

  const handleCancelMatchConfirm = useCallback(async () => {
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    setIsCancellingSession(true);
    try {
      await sessionsApi.cancelSession(context.sessionId);
      setCancelConfirmOpen(false);
      navigate("/match-key", { replace: true });
    } catch (error) {
      setSyncNotice(
        error instanceof Error ? error.message : "Failed to cancel match",
      );
    } finally {
      setIsCancellingSession(false);
    }
  }, [navigate]);

  const onAdjustMinutes = useCallback(
    (delta: number) => {
      const next = Math.max(
        0,
        Math.min(MAX_TIMER_SECONDS, timerSeconds + delta),
      );
      setTimerSeconds(next);
      saveClockAnchor(next);
      void commitEventCommand("clock", {
        period: quarter,
        clockSecondsRemaining: next,
        isRunning,
      });
    },
    [commitEventCommand, saveClockAnchor, timerSeconds, quarter, isRunning],
  );

  const onAdjustSeconds = useCallback(
    (delta: number) => {
      const next = Math.max(
        0,
        Math.min(MAX_TIMER_SECONDS, timerSeconds + delta),
      );
      setTimerSeconds(next);
      saveClockAnchor(next);
      void commitEventCommand("clock", {
        period: quarter,
        clockSecondsRemaining: next,
        isRunning,
      });
    },
    [commitEventCommand, saveClockAnchor, timerSeconds, quarter, isRunning],
  );

  const onStartStop = useCallback(() => {
    const next = !isRunning;
    setIsRunning(next);
    void commitEventCommand("clock", {
      period: quarter,
      clockSecondsRemaining: timerSeconds,
      isRunning: next,
    });
  }, [commitEventCommand, isRunning, quarter, timerSeconds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]'))
        return;
      e.preventDefault();
      onStartStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStartStop]);

  /**
   * Sends the foul command the moment its details are complete (fouler + type [+ fouled]),
   * per the agreed spec: fouls and free throws are separate payloads. Technical fouls carry
   * no fouledPlayerId. Free throws follow as individual `free_throw` commands.
   */
  const commitFoulImmediate = useCallback(
    async (draft: FoulFlowDraft) => {
      if (!isFoulerDraftComplete(draft) || draft.foulType === null) return;
      const isTechnical = draft.foulType === "technical";
      if (!isTechnical && draft.fouledJersey === null) return;
      const foulerTeamName = draft.foulerSide === "home" ? homeName : awayName;
      const fouledSide = opponentOf(draft.foulerSide!);
      const fouledTeamName = fouledSide === "home" ? homeName : awayName;
      // Bench/coach fouls now send `foulerRole` instead of `foulerPlayerId` — the backend's
      // FoulCommandDto made foulerPlayerId optional and added foulerRole for exactly this case.
      const committed = await commitEventCommand("foul", {
        teamId: draft.foulerSide
          ? getTeamIdForSide(draft.foulerSide)
          : undefined,
        foulerRole: draft.foulerRole,
        ...(draft.foulerRole === "player" &&
        draft.foulerSide !== null &&
        typeof draft.foulerJersey === "number"
          ? {
              foulerPlayerId: getPlayerId(draft.foulerSide, draft.foulerJersey),
            }
          : {}),
        ...(!isTechnical &&
        draft.foulerSide !== null &&
        typeof draft.fouledJersey === "number"
          ? {
              fouledPlayerId: getPlayerId(
                opponentOf(draft.foulerSide),
                draft.fouledJersey,
              ),
            }
          : {}),
        foulType: foulTypeToApiType(draft.foulType),
      });
      if (!committed) return;
      currentFoulLocalIdRef.current = committed.localId;
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: foulerTeamName,
        player: foulerLogPlayerField(draft, getPlayerLabel),
        action: "foul",
        result: isTechnical
          ? "Technical foul"
          : `${foulTypeLabel(draft.foulType)} on ${fouledTeamName} ${getPlayerLabel(fouledSide, draft.fouledJersey!)}`,
        localId: committed?.localId,
        meta: {
          foulerSide: draft.foulerSide,
          foulerJersey: draft.foulerJersey,
          foulerRole: draft.foulerRole,
          foulType: draft.foulType,
          fouledJersey: isTechnical ? null : draft.fouledJersey,
          ftCount: 0,
          ftResults: [],
          ftAssistJersey: null,
          reboundSide: null,
          reboundJersey: null,
        },
      });
      // Two technicals by the same on-court player = ejection.
      if (
        isTechnical &&
        draft.foulerRole === "player" &&
        draft.foulerSide !== null &&
        draft.foulerJersey !== null
      ) {
        const key = `${draft.foulerSide}:${draft.foulerJersey}`;
        const count = (technicalFoulTallyRef.current.get(key) ?? 0) + 1;
        technicalFoulTallyRef.current.set(key, count);
        if (count >= 2) {
          setPendingEjection({
            side: draft.foulerSide,
            jersey: draft.foulerJersey,
          });
        }
      }
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  const openShotFlowFromPlayer = useCallback(
    (side: TeamSide, jersey: number) => {
      if (
        foulPickerOpenRef.current ||
        subModalOpenRef.current ||
        timeoutModalOpenRef.current ||
        jumpBallModalOpenRef.current ||
        shotFlowRef.current !== "idle" ||
        foulFlowRef.current !== "idle" ||
        turnoverFlowRef.current !== "idle"
      )
        return;
      pendingCourtClickRef.current = null;
      setFoulFlow("idle");
      setTurnoverFlow("idle");
      setShotFlow({
        entry: "player",
        step: "shotType",
        draft: {
          ...emptyShotDraft(),
          side,
          shooterJersey: jersey,
          shotType: null,
          result: "made",
        },
      });
    },
    [],
  );

  const openShotFlowFromCourt = useCallback(
    (e: React.MouseEvent<Element>, result: "made" | "missed") => {
      if (
        foulPickerOpenRef.current ||
        subModalOpenRef.current ||
        timeoutModalOpenRef.current ||
        jumpBallModalOpenRef.current ||
        shotFlowRef.current !== "idle" ||
        foulFlowRef.current !== "idle" ||
        turnoverFlowRef.current !== "idle"
      )
        return;
      // Shift+left-click on court: foul at location (pick fouler); normal click: shot flow.
      if (e.shiftKey && result === "missed") {
        captureCourtPoint(e);
        setShotFlow("idle");
        setTurnoverFlow("idle");
        setFoulFlow(initialFoulFlowFromCourt());
        return;
      }
      captureCourtPoint(e);
      setFoulFlow("idle");
      setTurnoverFlow("idle");
      setShotFlow({
        entry: "court",
        step: "pickShooter",
        draft: { ...emptyShotDraft(), result },
      });
    },
    [captureCourtPoint],
  );

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
    if (curFoul !== "idle") {
      if (curFoul.step === "pickFouler") {
        setFoulPickerOpen(true);
        return;
      }
      return;
    }
    pendingCourtClickRef.current = null;
    setShotFlow("idle");
    setTurnoverFlow("idle");
    setFoulFlow("idle");
    setFoulPickerOpen(true);
  }, []);

  const handleFoulPanelPickerSelect = useCallback(
    (side: TeamSide, pick: PanelFoulPick) => {
      setFoulPickerOpen(false);
      setFoulFlow((cur) => {
        if (cur !== "idle" && cur.step === "pickFouler") {
          return foulFlowFromPanelPickAtPickFouler(cur, side, pick);
        }
        if (cur === "idle") {
          return initialFoulFlowFromPanelSelection(side, pick);
        }
        return cur;
      });
    },
    [],
  );

  const handleFoulPanelPickerCancel = useCallback(() => {
    setFoulPickerOpen(false);
  }, []);

  const openTurnoverFlowFromPanel = useCallback((side: TeamSide) => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      turnoverFlowRef.current !== "idle"
    )
      return;
    pendingCourtClickRef.current = null;
    setShotFlow("idle");
    setFoulFlow("idle");
    setFoulPickerOpen(false);
    setTurnoverFlow(initialTurnoverFlowFromPanel(side));
  }, []);

  const handleFoulFlowBack = useCallback(() => {
    setFoulFlow((cur) => {
      if (cur === "idle") return cur;
      const next = foulFlowBack(cur);
      return next === "idle" ? "idle" : next;
    });
  }, []);

  const handleFoulFlowCancel = useCallback(() => {
    clearPendingCourtPoint();
    setFoulFlow("idle");
    setFoulPickerOpen(false);
  }, [clearPendingCourtPoint]);

  const handleFoulPickFouler = useCallback((side: TeamSide, jersey: number) => {
    setFoulFlow((cur) => {
      if (cur === "idle" || cur.step !== "pickFouler") return cur;
      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      const bench =
        side === "home"
          ? benchRosterRef.current.home
          : benchRosterRef.current.away;
      const onCourt = active.includes(jersey);
      const onBench = bench.includes(jersey);
      if (!onCourt && !onBench) return cur;
      return {
        ...cur,
        step: "foulType",
        draft: {
          ...cur.draft,
          foulerSide: side,
          foulerJersey: jersey,
          foulerRole: onCourt ? "player" : "bench",
        },
      };
    });
  }, []);

  const handleFoulSelectType = useCallback(
    (foulType: FoulTypeId) => {
      const cur = foulFlowRef.current;
      if (cur === "idle" || cur.step !== "foulType") return;
      // Technical: no "who was fouled" step — the foul is sent right away and the
      // flow moves to picking the opposing team's FT shooter.
      if (foulType === "technical") {
        const draft = { ...cur.draft, foulType };
        if (!cur.draft.foulCommitted) {
          void commitFoulImmediate(draft);
          if (cur.entry === "court") {
            const pt = pendingCourtClickRef.current;
            if (pt && draft.foulerSide !== null) {
              const foulColor =
                draft.foulerSide === "home" ? homeTeamColor : awayTeamColor;
              setCourtFoulMarkers((prev) => [
                ...prev,
                { ...pt, color: foulColor },
              ]);
            }
          }
          pendingCourtClickRef.current = null;
        }
        setFoulFlow({
          ...cur,
          step: "pickFouled",
          draft: { ...draft, foulCommitted: true },
        });
        return;
      }
      setFoulFlow({
        ...cur,
        step: "pickFouled",
        draft: { ...cur.draft, foulType },
      });
    },
    [commitFoulImmediate, homeTeamColor, awayTeamColor],
  );

  const handleFoulPickFouled = useCallback(
    (jersey: number) => {
      const cur = foulFlowRef.current;
      if (cur === "idle" || cur.step !== "pickFouled") return;
      const { foulerSide } = cur.draft;
      if (foulerSide === null) return;
      const fouledSide = opponentOf(foulerSide);
      const active =
        fouledSide === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;
      const draft = { ...cur.draft, fouledJersey: jersey };
      // The foul goes to the backend now — free throws follow as separate commands.
      // (Technicals were already committed at type selection; foulCommitted guards re-sends.)
      if (!cur.draft.foulCommitted) {
        void commitFoulImmediate(draft);
        if (cur.entry === "court") {
          const pt = pendingCourtClickRef.current;
          if (pt && draft.foulerSide !== null) {
            const foulColor =
              draft.foulerSide === "home" ? homeTeamColor : awayTeamColor;
            setCourtFoulMarkers((prev) => [
              ...prev,
              { ...pt, color: foulColor },
            ]);
          }
        }
        pendingCourtClickRef.current = null;
      }
      // Offensive and double fouls have no free throws — end the flow immediately.
      const noFreeThrows =
        draft.foulType === "offensive" || draft.foulType === "double_foul";
      if (noFreeThrows) {
        pendingCourtClickRef.current = null;
        setFoulFlow("idle");
        return;
      }
      setFoulFlow({
        ...cur,
        step: "ftCount",
        draft: { ...draft, foulCommitted: true },
      });
    },
    [commitFoulImmediate, homeTeamColor, awayTeamColor],
  );

  const handleFoulSelectFtCount = useCallback((count: 0 | 1 | 2 | 3) => {
    const cur = foulFlowRef.current;
    if (cur === "idle" || cur.step !== "ftCount") return;
    const { draft } = cur;
    if (
      !isFoulerDraftComplete(draft) ||
      draft.foulType === null ||
      draft.fouledJersey === null
    ) {
      return;
    }
    // Foul was already committed when the fouled player / FT shooter was picked.
    if (count === 0) {
      pendingCourtClickRef.current = null;
      setFoulFlow("idle");
      return;
    }
    ftFirstLocalIdRef.current = null;
    // Technical FTs have no assist — go straight to recording results.
    if (draft.foulType === "technical") {
      setFoulFlow({
        ...cur,
        step: "ftResults",
        draft: {
          ...draft,
          ftCount: count,
          ftResults: [],
          ftAssistJersey: "none",
        },
      });
      return;
    }
    setFoulFlow({
      ...cur,
      step: "ftAssist",
      draft: { ...draft, ftCount: count, ftResults: [], ftAssistJersey: null },
    });
  }, []);

  const handleFoulFtAssistSelect = useCallback((assist: number | "none") => {
    setFoulFlow((cur) => {
      if (cur === "idle" || cur.step !== "ftAssist") return cur;
      const n = cur.draft.ftCount;
      const fj = cur.draft.fouledJersey;
      if (n === null || n < 1 || fj === null) return cur;
      if (assist !== "none" && assist === fj) return cur;
      if (assist !== "none") {
        const fouledSide =
          cur.draft.foulerSide !== null
            ? opponentOf(cur.draft.foulerSide)
            : null;
        if (fouledSide === null) return cur;
        const active =
          fouledSide === "home"
            ? activeRosterRef.current.home
            : activeRosterRef.current.away;
        if (!active.includes(assist)) return cur;
      }
      return {
        ...cur,
        step: "ftResults",
        draft: { ...cur.draft, ftAssistJersey: assist },
      };
    });
  }, []);

  const handleFoulFtResult = useCallback(
    (result: "made" | "miss") => {
      const cur = foulFlowRef.current;
      if (cur === "idle" || cur.step !== "ftResults") return;
      const { draft } = cur;
      const n = draft.ftCount;
      if (n === null || n < 1) return;
      const idx = draft.ftResults.length;
      if (idx >= n) return;
      if (draft.foulerSide === null || draft.fouledJersey === null) return;
      const shooterSide = opponentOf(draft.foulerSide);
      const shooterJersey = draft.fouledJersey;
      const shooterTeamName = shooterSide === "home" ? homeName : awayName;
      const attempt = idx + 1;
      const isMade = result === "made";
      const nextResults = [...draft.ftResults, result];
      const isLast = nextResults.length >= n;
      const anyMade = nextResults.includes("made");
      const assistJersey =
        typeof draft.ftAssistJersey === "number" ? draft.ftAssistJersey : null;

      // Each free throw is its own backend command, sent the moment it's tapped.
      // Backend Gap #15: a free throw belongs to the foul that awarded it, so reversing the foul
      // later removes them together. It's linked by the foul's queue id and resolved to its real
      // event id at the moment the free throw is sent — so the link exists even if the foul was
      // still syncing when this was tapped.
      const parentLocalId = currentFoulLocalIdRef.current ?? undefined;
      void (async () => {
        const cmd = await commitEventCommand(
          "free_throw",
          {
            teamId: getTeamIdForSide(shooterSide),
            shooterPlayerId: getPlayerId(shooterSide, shooterJersey),
            attempt,
            totalAttempts: n,
            result: isMade ? "made" : "missed",
            // Assist candidate rides on the first FT only; the backend decides the
            // official award per the FIBA manual (at most 1 assist per sequence).
            ...(attempt === 1 && assistJersey !== null
              ? {
                  assistCandidatePlayerId: getPlayerId(shooterSide, assistJersey),
                }
              : {}),
          },
          { parentLocalId },
        );
        if (attempt === 1) ftFirstLocalIdRef.current = cmd?.localId ?? null;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: shooterTeamName,
          player: getPlayerLabel(shooterSide, shooterJersey),
          action: "free throw",
          result: `${isMade ? "Made" : "Missed"} (${attempt}/${n})`,
          localId: cmd?.localId,
          meta: {
            shooterSide,
            shooterJersey,
            attempt,
            totalAttempts: n,
            result: isMade ? "made" : "missed",
            foulerSide: draft.foulerSide,
            foulerJersey: draft.foulerJersey,
            foulType: draft.foulType,
            parentLocalId,
          },
        });
        // One assist max for the whole sequence, shown once at least one FT is made.
        if (isLast && anyMade && assistJersey !== null) {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: shooterTeamName,
            player: getPlayerLabel(shooterSide, assistJersey),
            action: "assist",
            result: `To ${getPlayerLabel(shooterSide, shooterJersey)} (FT)`,
            localId: ftFirstLocalIdRef.current ?? undefined,
            meta: {
              side: shooterSide,
              assistJersey,
              assistedJersey: shooterJersey,
            },
          });
        }
      })();

      // Live score updates on every made free throw.
      if (isMade) {
        if (shooterSide === "home") setHomeScore((s) => s + 1);
        else setAwayScore((s) => s + 1);
      }

      if (!isLast) {
        setFoulFlow({ ...cur, draft: { ...draft, ftResults: nextResults } });
        return;
      }
      pendingCourtClickRef.current = null;
      setFoulFlow("idle");
      // Rebound only happens if the *last* free throw was missed.
      if (!isMade) {
        setShotFlow({
          entry: cur.entry === "court" ? "court" : "player",
          step: "pickRebounder",
          draft: {
            ...emptyShotDraft(),
            result: "missed",
            side: shooterSide,
          },
        });
      }
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  const handleFoulPickRebounder = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = foulFlowRef.current;
      if (cur === "idle" || cur.step !== "rebounder") return;
      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;
      const { draft } = cur;
      const shooterSide =
        draft.foulerSide !== null ? opponentOf(draft.foulerSide) : null;
      const reboundType: "offensive" | "defensive" =
        shooterSide !== null && side === shooterSide
          ? "offensive"
          : "defensive";
      pendingCourtClickRef.current = null;
      setFoulFlow("idle");
      void (async () => {
        const committed = await commitEventCommand("rebound", {
          teamId: getTeamIdForSide(side),
          reboundPlayerId: getPlayerId(side, jersey),
          rebound: { type: reboundType },
        });
        if (!committed) return;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: side === "home" ? homeName : awayName,
          player: getPlayerLabel(side, jersey),
          action: "rebound",
          result: reboundType === "offensive" ? "Off Rebound" : "Def Rebound",
          localId: committed.localId,
          meta: { side, jersey, reboundType },
        });
      })();
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  // Second technical foul = ejection: once the foul/FT flows settle, show the notice
  // and open the substitution modal so the player is subbed out immediately.
  useEffect(() => {
    if (pendingEjection === null) return;
    if (foulFlow !== "idle" || shotFlow !== "idle") return;
    const teamName = pendingEjection.side === "home" ? homeName : awayName;
    setEjectionNotice(
      `${getPlayerLabel(pendingEjection.side, pendingEjection.jersey)} (${teamName}) has 2 technical fouls and must leave the game. Substitute them now.`,
    );
    setSubDraftHome(cloneLineup(homeLineup));
    setSubDraftAway(cloneLineup(awayLineup));
    setSubModalOpen(true);
    setPendingEjection(null);
  }, [
    pendingEjection,
    foulFlow,
    shotFlow,
    homeName,
    awayName,
    getPlayerLabel,
    homeLineup,
    awayLineup,
  ]);

  const handleModalBack = useCallback(() => {
    const cur = shotFlowRef.current;
    if (cur === "idle") return;

    // Tip-in putback picker: return to the outcome buttons (reboundBranch: null).
    // No rebound log to undo — rebound is committed only when the shooter jersey is tapped,
    // not when the outcome type (Layup Made / Dunk Miss / etc.) is selected.
    if (
      cur.step === "pickShooter" &&
      cur.draft.tipInCommit &&
      cur.draft.priorMiss !== null
    ) {
      const pm = cur.draft.priorMiss;
      setShotFlow({
        entry: cur.entry,
        step: "pickRebounder",
        draft: {
          ...emptyShotDraft(),
          result: "missed",
          tipInCommit: false,
          side: pm.side,
          shooterJersey: pm.shooterJersey,
          // The original miss was already committed when the tip-in outcome was
          // selected — shotType must stay null so re-resolving the rebound does
          // not send the shot a second time.
          shotType: null,
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
    if (
      cur.step === "pickShooter" &&
      !cur.draft.tipInCommit &&
      cur.entry === "court"
    ) {
      clearPendingCourtPoint();
      setShotFlow("idle");
      return;
    }

    // Blocker step: go back to rebound options.
    if (cur.step === "pickBlocker") {
      setShotFlow({
        ...cur,
        step: "pickRebounder",
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
      cur.step === "pickRebounder" &&
      cur.draft.reboundBranch === null &&
      cur.draft.blockerSide !== null
    ) {
      setGameLog((prev) => {
        const head = prev[0];
        if (head && head.action === "block") return prev.slice(1);
        return prev;
      });
      setShotFlow({
        ...cur,
        step: "pickBlocker",
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
      cur.step === "pickRebounder" &&
      (cur.entry === "court" || cur.entry === "player") &&
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
            head.action === "shot" &&
            head.player === `#${d.shooterJersey}` &&
            /missed/i.test(head.result)
          ) {
            return prev.slice(1);
          }
          return prev;
        });
        if (cur.entry === "court") {
          setCourtShotMarkers((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (last.kind === "missed") return prev.slice(0, -1);
            return prev;
          });
        }
        setShotFlow({
          entry: cur.entry,
          step: "shotType",
          draft: {
            ...emptyShotDraft(),
            result: "missed",
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
      if (inner === "idle") return inner;
      if (
        inner.step === "pickRebounder" &&
        inner.draft.reboundBranch !== null
      ) {
        return { ...inner, draft: { ...inner.draft, reboundBranch: null } };
      }
      if (inner.step === "assist") {
        return {
          ...inner,
          step: "shotType",
          draft: { ...inner.draft, shotType: null },
        };
      }
      if (inner.step === "shotType") {
        if (inner.entry === "court") {
          return {
            ...inner,
            step: "pickShooter",
            draft: { ...emptyShotDraft(), result: inner.draft.result },
          };
        }
        return "idle";
      }
      return inner;
    });
  }, [clearPendingCourtPoint]);

  const handleModalCancel = useCallback(() => {
    clearPendingCourtPoint();
    setShotFlow("idle");
  }, [clearPendingCourtPoint]);

  const handlePickRebounder = useCallback(
    (side: TeamSide, jersey: number) => {
      // Read the current flow from the ref (not a setShotFlow updater) — React does not
      // guarantee the updater callback runs synchronously, so a closure variable set inside
      // it and read immediately after the setShotFlow(...) call can still be null/stale.
      const prev = shotFlowRef.current;
      if (prev === "idle" || prev.step !== "pickRebounder") return;

      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;

      const teamName = side === "home" ? homeName : awayName;
      const branch = prev.draft.reboundBranch;
      const shooterSide = prev.draft.side ?? prev.draft.priorMiss?.side ?? null;
      const reboundType: "offensive" | "defensive" =
        shooterSide !== null && side === shooterSide
          ? "offensive"
          : "defensive";
      const reboundLogRow: Omit<GameLogEntry, "id"> = {
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: getPlayerLabel(side, jersey),
        action: "rebound",
        result: reboundType === "offensive" ? "Off Rebound" : "Def Rebound",
        meta: { side, jersey, reboundType },
      };
      // Capture court coords before any branch clears the ref.
      const pendingPt = pendingCourtClickRef.current;
      // Snapshot of the pending missed shot (set when shotType is non-null — cleared in block path).
      const pendingShot =
        prev.draft.shotType !== null
          ? {
              side: prev.draft.side,
              shooterJersey: prev.draft.shooterJersey,
              shotType: prev.draft.shotType,
              fastBreak: prev.draft.fastBreak,
            }
          : null;

      let nextFlow: ShotFlowState;

      // Simple rebound: tap jersey only (no modal branch) — end flow.
      if (branch === null) {
        pendingCourtClickRef.current = null;
        nextFlow = "idle";
      } else if (branch === "block_involved") {
        // Block: offensive rebounder first, then blocker step.
        const priorMiss = snapshotPriorMiss(prev.draft);
        nextFlow = {
          ...prev,
          step: "pickBlocker",
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
        let tipInResult: "made" | "missed";
        switch (branch) {
          case "tipin_layup_miss":
            tipInShotType = "layup";
            tipInResult = "missed";
            break;
          case "tipin_dunk_miss":
            tipInShotType = "dunk";
            tipInResult = "missed";
            break;
          case "tipin_layup_made":
            tipInShotType = "layup";
            tipInResult = "made";
            break;
          case "tipin_dunk_made":
            tipInShotType = "dunk";
            tipInResult = "made";
            break;
          default:
            return;
        }

        const priorMiss = snapshotPriorMiss(prev.draft);
        nextFlow = {
          ...prev,
          step: "pickShooter",
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
        // Commit the deferred missed shot (skipped if shot was already sent — e.g. post-block).
        if (
          pendingShot?.side &&
          pendingShot.shooterJersey !== null &&
          pendingShot.shotType
        ) {
          const missIsThree =
            pendingPt !== null &&
            isCourtClickThreePointer(
              pendingPt.nx,
              pendingPt.ny,
              pendingShot.side,
              homeAttacksLeft,
            );
          const missValue = missIsThree
            ? 3
            : getShotPoints(pendingShot.shotType);
          const shotCommitted = await commitEventCommand("shot", {
            teamId: getTeamIdForSide(pendingShot.side),
            shooterPlayerId: getPlayerId(
              pendingShot.side,
              pendingShot.shooterJersey!,
            ),
            shot: {
              value: missValue,
              result: "missed",
              type: shotTypeToApiType(pendingShot.shotType),
              ...(pendingShot.fastBreak ? { playType: "fast_break" } : {}),
              ...(pendingPt ? { x: pendingPt.nx, y: pendingPt.ny } : {}),
            },
          });
          if (shotCommitted) {
            appendLog({
              period: periodLabel,
              clock: clockLabel,
              team: pendingShot.side === "home" ? homeName : awayName,
              player: getPlayerLabel(
                pendingShot.side,
                pendingShot.shooterJersey!,
              ),
              action: "shot",
              result: missIsThree
                ? "3pt missed"
                : shotTypeResultPhrase(pendingShot.shotType, "missed"),
              localId: shotCommitted.localId,
              meta: {
                side: pendingShot.side,
                shooterJersey: pendingShot.shooterJersey,
                shotType: pendingShot.shotType,
                shotValue: missValue,
                result: "missed",
                ...(pendingPt ? { x: pendingPt.nx, y: pendingPt.ny } : {}),
              },
            });
          }
        }
        const committed = await commitEventCommand("rebound", {
          teamId: getTeamIdForSide(side),
          reboundPlayerId: getPlayerId(side, jersey),
          rebound: { type: reboundType },
        });
        if (!committed) return;
        appendLog({ ...reboundLogRow, localId: committed.localId });
      })();
    },
    [
      appendLog,
      awayName,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      homeAttacksLeft,
      homeName,
      periodLabel,
    ],
  );

  const handlePickBlocker = useCallback(
    (side: TeamSide, jersey: number) => {
      const prev = shotFlowRef.current;
      if (prev === "idle" || prev.step !== "pickBlocker") return;

      const offenseSide =
        prev.draft.priorMiss?.side ??
        prev.draft.side ??
        (prev.draft.blockerSide !== null
          ? opponentOf(prev.draft.blockerSide)
          : null);
      const expectedBlockerSide =
        offenseSide === null ? null : opponentOf(offenseSide);
      if (expectedBlockerSide === null) return;
      if (side !== expectedBlockerSide) return;

      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;

      const teamName = side === "home" ? homeName : awayName;
      const blockedShooter: { side: TeamSide; jersey: number } | null =
        offenseSide !== null && prev.draft.shooterJersey !== null
          ? { side: offenseSide, jersey: prev.draft.shooterJersey }
          : null;
      const blockLogRow: Omit<GameLogEntry, "id"> = {
        period: periodLabel,
        clock: clockLabel,
        team: teamName,
        player: getPlayerLabel(side, jersey),
        action: "block",
        result: "Block",
        meta: { side, jersey },
      };

      setShotFlow({
        ...prev,
        step: "pickRebounder",
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
        // Snapshot the shooter's details before state is mutated.
        const missedShotType =
          prev.draft.priorMiss?.shotType ?? prev.draft.shotType;
        const missedFastBreak =
          prev.draft.priorMiss?.fastBreak ?? prev.draft.fastBreak;
        const pendingPt = pendingCourtClickRef.current;

        void (async () => {
          const missIsThree =
            missedShotType !== null &&
            pendingPt !== null &&
            isCourtClickThreePointer(
              pendingPt.nx,
              pendingPt.ny,
              blockedShooter.side,
              homeAttacksLeft,
            );
          const missValue = missedShotType
            ? missIsThree
              ? 3
              : getShotPoints(missedShotType)
            : 2;
          // Shot and block are sent as one event: the missed shot carries blockPlayerId.
          const shotCommitted = missedShotType
            ? await commitEventCommand("shot", {
                teamId: getTeamIdForSide(blockedShooter.side),
                shooterPlayerId: getPlayerId(
                  blockedShooter.side,
                  blockedShooter.jersey,
                ),
                blockPlayerId: getPlayerId(side, jersey),
                shot: {
                  value: missValue,
                  result: "missed",
                  type: shotTypeToApiType(missedShotType),
                  ...(missedFastBreak ? { playType: "fast_break" } : {}),
                  ...(pendingPt ? { x: pendingPt.nx, y: pendingPt.ny } : {}),
                },
              })
            : null;
          if (shotCommitted) {
            appendLog({
              period: periodLabel,
              clock: clockLabel,
              team: blockedShooter.side === "home" ? homeName : awayName,
              player: getPlayerLabel(
                blockedShooter.side,
                blockedShooter.jersey,
              ),
              action: "shot",
              result: missedShotType
                ? missIsThree
                  ? "3pt missed"
                  : shotTypeResultPhrase(missedShotType, "missed")
                : "Missed",
              localId: shotCommitted.localId,
              meta: {
                side: blockedShooter.side,
                shooterJersey: blockedShooter.jersey,
                shotType: missedShotType,
                shotValue: missValue,
                result: "missed",
              },
            });
          }
          // Block log entry shares the shot's localId — the block is part of the same event.
          appendLog({ ...blockLogRow, localId: shotCommitted?.localId });
        })();
      }
    },
    [
      appendLog,
      awayName,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      homeAttacksLeft,
      homeName,
      periodLabel,
    ],
  );

  const handlePickShooter = useCallback(
    (side: TeamSide, jersey: number) => {
      const prev = shotFlowRef.current;
      if (prev === "idle" || prev.step !== "pickShooter") return;

      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;

      if (prev.draft.tipInCommit) {
        const { shotType, result } = prev.draft;
        if (shotType === null) return;

        // Missed tip-in → next rebound screen. The putback is committed below, so
        // shotType stays null (a non-null shotType at pickRebounder means "deferred
        // shot still pending" and would re-send the putback as a duplicate).
        // priorMiss carries the shooter's identity for tip-in/block sub-flows.
        setShotFlow(
          result === "made"
            ? "idle"
            : {
                entry: "court",
                step: "pickRebounder",
                draft: {
                  ...emptyShotDraft(),
                  result: "missed",
                  tipInCommit: false,
                  side,
                  shooterJersey: jersey,
                  shotType: null,
                  priorMiss: {
                    side,
                    shooterJersey: jersey,
                    shotType,
                    fastBreak: false,
                  },
                },
              },
        );

        // A putback happens right at the basket, not wherever the original shot was
        // taken from — always 2 points, at a fixed rim position (never the original
        // miss's court click, which may have been from well beyond the arc).
        const rimPos = getRimPosition(side, homeAttacksLeft);
        const putbackType =
          shotType === "dunk" ? "putback-dunk" : "putback-layup";

        void (async () => {
          const teamName = side === "home" ? homeName : awayName;
          const playerLabel = getPlayerLabel(side, jersey);

          // Rebounder = shooter — commit the offensive rebound first.
          const reboundCommitted = await commitEventCommand("rebound", {
            teamId: getTeamIdForSide(side),
            reboundPlayerId: getPlayerId(side, jersey),
            rebound: { type: "offensive" },
          });
          if (reboundCommitted) {
            appendLog({
              period: periodLabel,
              clock: clockLabel,
              team: teamName,
              player: playerLabel,
              action: "rebound",
              result: "Off Rebound",
              localId: reboundCommitted.localId,
              meta: { side, jersey, reboundType: "offensive" },
            });
          }

          const points = getShotPoints(shotType);

          const committed = await commitEventCommand("shot", {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(side, jersey),
            shot: {
              value: points,
              result,
              type: putbackType,
              x: rimPos.nx,
              y: rimPos.ny,
            },
          });
          if (!committed) return;
          if (result === "made") {
            if (side === "home") setHomeScore((x) => x + points);
            else setAwayScore((x) => x + points);
          }

          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: teamName,
            player: playerLabel,
            action: "shot",
            result: shotTypeResultPhrase(shotType, result),
            localId: committed.localId,
            meta: {
              side,
              shooterJersey: jersey,
              shotType,
              shotValue: points,
              result,
            },
          });

          const shotColor = side === "home" ? homeTeamColor : awayTeamColor;
          setCourtShotMarkers((prevM) => [
            ...prevM,
            {
              ...rimPos,
              color: shotColor,
              kind: result === "missed" ? "missed" : "made",
            },
          ]);
          pendingCourtClickRef.current = null;
        })();
        return;
      }

      setShotFlow({
        ...prev,
        step: "shotType",
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
      homeAttacksLeft,
      homeName,
      homeTeamColor,
      periodLabel,
      setCourtShotMarkers,
      commitEventCommand,
    ],
  );

  const handleSelectReboundOutcome = useCallback(
    (outcome: ReboundOutcomeId) => {
      const prev = shotFlowRef.current;
      if (prev === "idle" || prev.step !== "pickRebounder") return;

      if (
        outcome === "dead_out_of_bounds" ||
        outcome === "dead_shot_clock_violation"
      ) {
        const deadReason =
          outcome === "dead_out_of_bounds"
            ? "out_of_bounds"
            : "shot_clock_violation";
        const deadBallLogRow: Omit<GameLogEntry, "id"> = {
          period: periodLabel,
          clock: clockLabel,
          team: "Officials",
          player: "—",
          action: "dead ball",
          result:
            outcome === "dead_out_of_bounds"
              ? "Out of bounds"
              : "24 sec violation",
        };
        // Capture shot details and coords before clearing state.
        const pendingPt = pendingCourtClickRef.current;
        const pendingShot =
          prev.draft.shotType !== null
            ? {
                side: prev.draft.side,
                shooterJersey: prev.draft.shooterJersey,
                shotType: prev.draft.shotType,
                fastBreak: prev.draft.fastBreak,
              }
            : null;
        pendingCourtClickRef.current = null;
        setShotFlow("idle");

        // Shooter's side survives in the draft even when the shot was already committed
        // (post-block or post-putback) — used to derive the defending team for the dead ball.
        const shooterSideForDead =
          prev.draft.side ?? prev.draft.priorMiss?.side ?? null;
        void (async () => {
          // Commit the deferred missed shot first.
          if (
            pendingShot?.side &&
            pendingShot.shooterJersey !== null &&
            pendingShot.shotType
          ) {
            const missIsThree =
              pendingPt !== null &&
              isCourtClickThreePointer(
                pendingPt.nx,
                pendingPt.ny,
                pendingShot.side,
                homeAttacksLeft,
              );
            const missValue = missIsThree
              ? 3
              : getShotPoints(pendingShot.shotType);
            const shotCommitted = await commitEventCommand("shot", {
              teamId: getTeamIdForSide(pendingShot.side),
              shooterPlayerId: getPlayerId(
                pendingShot.side,
                pendingShot.shooterJersey!,
              ),
              shot: {
                value: missValue,
                result: "missed",
                type: shotTypeToApiType(pendingShot.shotType),
                ...(pendingShot.fastBreak ? { playType: "fast_break" } : {}),
                ...(pendingPt ? { x: pendingPt.nx, y: pendingPt.ny } : {}),
              },
            });
            if (shotCommitted) {
              appendLog({
                period: periodLabel,
                clock: clockLabel,
                team: pendingShot.side === "home" ? homeName : awayName,
                player: getPlayerLabel(
                  pendingShot.side,
                  pendingShot.shooterJersey!,
                ),
                action: "shot",
                result: missIsThree
                  ? "3pt missed"
                  : shotTypeResultPhrase(pendingShot.shotType, "missed"),
                localId: shotCommitted.localId,
                meta: {
                  side: pendingShot.side,
                  shooterJersey: pendingShot.shooterJersey,
                  shotType: pendingShot.shotType,
                  shotValue: missValue,
                  result: "missed",
                },
              });
            }
          }
          // Dead ball — possession goes to the defending team.
          const defSide = shooterSideForDead
            ? opponentOf(shooterSideForDead)
            : "home";
          const committed = await commitEventCommand("dead_ball", {
            teamId: getTeamIdForSide(defSide),
            deadBall: { reason: deadReason },
          });
          if (!committed) return;
          appendLog(deadBallLogRow);
        })();
        return;
      }

      // Block: go directly to pickBlocker — skip the "tap offensive rebounder jersey" step.
      // Preserve side/shooterJersey so handlePickBlocker can identify the blocked player.
      // Note: post-putback (shotType null) priorMiss stays null on purpose — the putback
      // was already committed, so handlePickBlocker must not re-send it with the block.
      if (outcome === "block_involved") {
        const priorMiss = snapshotPriorMiss(prev.draft);
        setShotFlow({
          ...prev,
          step: "pickBlocker",
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
      let tipInResult: "made" | "missed";
      switch (outcome) {
        case "tipin_layup_miss":
          tipInShotType = "layup";
          tipInResult = "missed";
          break;
        case "tipin_dunk_miss":
          tipInShotType = "dunk";
          tipInResult = "missed";
          break;
        case "tipin_layup_made":
          tipInShotType = "layup";
          tipInResult = "made";
          break;
        case "tipin_dunk_made":
          tipInShotType = "dunk";
          tipInResult = "made";
          break;
        default:
          return;
      }
      // In a post-block context side/shooterJersey are cleared, so snapshotPriorMiss returns
      // null. Fall back to the already-stored priorMiss so Back navigation still works.
      const priorMiss = snapshotPriorMiss(prev.draft) ?? prev.draft.priorMiss;

      // Snapshot original miss details before the draft is overwritten.
      // When side is null we're in a post-block tip-in — shot was already committed.
      const pendingShot =
        prev.draft.side !== null && prev.draft.shotType !== null
          ? {
              side: prev.draft.side,
              shooterJersey: prev.draft.shooterJersey,
              shotType: prev.draft.shotType,
              fastBreak: prev.draft.fastBreak,
            }
          : null;
      const pendingPt = pendingCourtClickRef.current;

      setShotFlow({
        ...prev,
        step: "pickShooter",
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

      // Commit the original missed shot (skip in post-block — already sent from handlePickBlocker).
      if (
        pendingShot?.side &&
        pendingShot.shooterJersey !== null &&
        pendingShot.shotType
      ) {
        void (async () => {
          const missIsThree =
            pendingPt !== null &&
            isCourtClickThreePointer(
              pendingPt.nx,
              pendingPt.ny,
              pendingShot.side!,
              homeAttacksLeft,
            );
          const missValue = missIsThree
            ? 3
            : getShotPoints(pendingShot.shotType!);
          const shotCommitted = await commitEventCommand("shot", {
            teamId: getTeamIdForSide(pendingShot.side!),
            shooterPlayerId: getPlayerId(
              pendingShot.side!,
              pendingShot.shooterJersey!,
            ),
            shot: {
              value: missValue,
              result: "missed",
              type: shotTypeToApiType(pendingShot.shotType!),
              ...(pendingShot.fastBreak ? { playType: "fast_break" } : {}),
              ...(pendingPt ? { x: pendingPt.nx, y: pendingPt.ny } : {}),
            },
          });
          if (shotCommitted) {
            appendLog({
              period: periodLabel,
              clock: clockLabel,
              team: pendingShot.side === "home" ? homeName : awayName,
              player: getPlayerLabel(
                pendingShot.side!,
                pendingShot.shooterJersey!,
              ),
              action: "shot",
              result: missIsThree
                ? "3pt missed"
                : shotTypeResultPhrase(pendingShot.shotType!, "missed"),
              localId: shotCommitted.localId,
              meta: {
                side: pendingShot.side,
                shooterJersey: pendingShot.shooterJersey,
                shotType: pendingShot.shotType,
                shotValue: missValue,
                result: "missed",
              },
            });
          }
        })();
      }
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      homeAttacksLeft,
      homeName,
      awayName,
      periodLabel,
    ],
  );

  const handleSelectShotType = useCallback(
    async (shotType: ShotTypeId) => {
      const cur = shotFlowRef.current;
      if (cur === "idle" || cur.step !== "shotType") return;
      const nextDraft = { ...cur.draft, shotType };
      if (
        nextDraft.result === "missed" &&
        nextDraft.side !== null &&
        nextDraft.shooterJersey !== null
      ) {
        // Add the court marker immediately for visual feedback; the shot command is deferred
        // until the rebound outcome is known so we can include blockPlayerId when blocked.
        if (cur.entry === "court") {
          const clickPt = pendingCourtClickRef.current;
          if (clickPt && nextDraft.side !== null) {
            const shotColor =
              nextDraft.side === "home" ? homeTeamColor : awayTeamColor;
            setCourtShotMarkers((prev) => [
              ...prev,
              { ...clickPt, color: shotColor, kind: "missed" },
            ]);
          }
        }
        setShotFlow({
          entry: cur.entry,
          step: "pickRebounder",
          draft: {
            ...emptyShotDraft(),
            result: "missed",
            tipInCommit: false,
            side: nextDraft.side,
            shooterJersey: nextDraft.shooterJersey,
            shotType,
            fastBreak: nextDraft.fastBreak,
          },
        });
        return;
      }
      setShotFlow({
        ...cur,
        step: "assist",
        draft: nextDraft,
      });
    },
    [awayTeamColor, homeTeamColor],
  );

  const handleSetFastBreak = useCallback((fastBreak: boolean) => {
    setShotFlow((cur) => {
      if (cur === "idle" || cur.step !== "shotType") return cur;
      return { ...cur, draft: { ...cur.draft, fastBreak } };
    });
  }, []);

  const handleSelectAssist = useCallback(
    async (assist: number | "none") => {
      const cur = shotFlowRef.current;
      if (cur === "idle" || cur.step !== "assist") return;
      const { draft } = cur;
      if (
        draft.side === null ||
        draft.shooterJersey === null ||
        draft.shotType === null
      )
        return;
      if (assist !== "none" && assist === draft.shooterJersey) return;
      if (assist !== "none") {
        const active =
          draft.side === "home"
            ? activeRosterRef.current.home
            : activeRosterRef.current.away;
        if (!active.includes(assist)) return;
      }

      const pt = pendingCourtClickRef.current;
      const isThreeFromCourt =
        cur.entry === "court" &&
        pt !== null &&
        draft.side !== null &&
        isCourtClickThreePointer(pt.nx, pt.ny, draft.side, homeAttacksLeft);
      const points = isThreeFromCourt ? 3 : getShotPoints(draft.shotType);

      const shotCmd = await commitEventCommand("shot", {
        teamId: draft.side ? getTeamIdForSide(draft.side) : undefined,
        shooterPlayerId:
          draft.side && typeof draft.shooterJersey === "number"
            ? getPlayerId(draft.side, draft.shooterJersey)
            : undefined,
        ...(assist !== "none" && draft.result === "made"
          ? { assistPlayerId: getPlayerId(draft.side, assist) }
          : {}),
        shot: {
          value: points,
          result: draft.result,
          type: shotTypeToApiType(draft.shotType),
          ...(draft.fastBreak ? { playType: "fast_break" } : {}),
          ...(cur.entry === "court" && pt ? { x: pt.nx, y: pt.ny } : {}),
        },
      });
      if (!shotCmd) return;

      const teamName = draft.side === "home" ? homeName : awayName;
      if (draft.result === "made") {
        if (draft.side === "home") setHomeScore((s) => s + points);
        else setAwayScore((s) => s + points);
      }

      const shotResultParts = [
        isThreeFromCourt
          ? "3pt made"
          : shotTypeResultPhrase(draft.shotType, draft.result),
      ];
      if (draft.fastBreak) shotResultParts.push("Fast break");
      const shotResult = shotResultParts.join(" · ");

      if (assist !== "none") {
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: teamName,
          player: getPlayerLabel(draft.side, assist),
          action: "assist",
          result: `To ${getPlayerLabel(draft.side, draft.shooterJersey)}`,
          localId: shotCmd.localId,
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
        action: "shot",
        result: shotResult,
        localId: shotCmd.localId,
        meta: {
          side: draft.side,
          shooterJersey: draft.shooterJersey,
          shotType: draft.shotType,
          shotValue: points,
          result: draft.result,
          ...(cur.entry === "court" && pt ? { x: pt.nx, y: pt.ny } : {}),
        },
      });

      if (cur.entry === "court") {
        const clickPt = pendingCourtClickRef.current;
        if (clickPt && draft.side !== null) {
          const shotColor =
            draft.side === "home" ? homeTeamColor : awayTeamColor;
          setCourtShotMarkers((prev) => [
            ...prev,
            {
              ...clickPt,
              color: shotColor,
              kind: draft.result === "missed" ? "missed" : "made",
            },
          ]);
          pendingCourtClickRef.current = null;
        }
      } else {
        pendingCourtClickRef.current = null;
      }

      setShotFlow("idle");
    },
    [
      appendLog,
      awayName,
      awayTeamColor,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      homeAttacksLeft,
      homeName,
      homeTeamColor,
      periodLabel,
    ],
  );

  const commitTurnoverLog = useCallback(
    async (
      draft: TurnoverFlowDraft,
      steal: { side: TeamSide; jersey: number } | null,
    ) => {
      if (draft.committingJersey === null || draft.turnoverType === null)
        return;
      const committed = await commitEventCommand("turnover", {
        teamId: getTeamIdForSide(draft.committingSide),
        turnoverPlayerId: getPlayerId(
          draft.committingSide,
          draft.committingJersey,
        ),
        ...(steal !== null
          ? { stealPlayerId: getPlayerId(steal.side, steal.jersey) }
          : {}),
        turnover: {
          type: draft.turnoverType,
        },
      });
      if (!committed) return;
      const committingTeam =
        draft.committingSide === "home" ? homeName : awayName;
      const typeLabel = turnoverTypeLabel(draft.turnoverType);
      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: committingTeam,
        player: getPlayerLabel(draft.committingSide, draft.committingJersey),
        action: "turnover",
        result: typeLabel,
        localId: committed.localId,
        meta: {
          side: draft.committingSide,
          jersey: draft.committingJersey,
          turnoverType: draft.turnoverType,
        },
      });
      if (steal !== null) {
        const stealTeam = steal.side === "home" ? homeName : awayName;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: stealTeam,
          player: getPlayerLabel(steal.side, steal.jersey),
          action: "steal",
          result: `Off ${getPlayerLabel(draft.committingSide, draft.committingJersey)} turnover`,
          localId: committed.localId,
          meta: {
            side: steal.side,
            jersey: steal.jersey,
          },
        });
      }
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getPlayerId,
      getPlayerLabel,
      getTeamIdForSide,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  const handleTurnoverFlowBack = useCallback(() => {
    setTurnoverFlow((cur) => {
      if (cur === "idle") return cur;
      const next = turnoverFlowBack(cur);
      return next === "idle" ? "idle" : next;
    });
  }, []);

  const handleTurnoverFlowCancel = useCallback(() => {
    setTurnoverFlow("idle");
  }, []);

  const handleTurnoverPickCommittingPlayer = useCallback((jersey: number) => {
    setTurnoverFlow((cur) => {
      if (cur === "idle" || cur.step !== "pickPlayer") return cur;
      const { committingSide } = cur.draft;
      const active =
        committingSide === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return cur;
      return {
        ...cur,
        step: "turnoverType",
        draft: { ...cur.draft, committingJersey: jersey },
      };
    });
  }, []);

  const handleTurnoverSelectType = useCallback(
    (type: TurnoverTypeId) => {
      const cur = turnoverFlowRef.current;
      if (cur === "idle" || cur.step !== "turnoverType") return;
      const draft: TurnoverFlowDraft = { ...cur.draft, turnoverType: type };
      if (type === "ball_handling" || type === "bad_pass") {
        setTurnoverFlow({ ...cur, step: "steal", draft });
        return;
      }
      void commitTurnoverLog(draft, null);
      setTurnoverFlow("idle");
    },
    [commitTurnoverLog],
  );

  const handleTurnoverNoSteal = useCallback(() => {
    const cur = turnoverFlowRef.current;
    if (cur === "idle" || cur.step !== "steal") return;
    void commitTurnoverLog(cur.draft, null);
    setTurnoverFlow("idle");
  }, [commitTurnoverLog]);

  const handleTurnoverPickStealer = useCallback(
    (side: TeamSide, jersey: number) => {
      const cur = turnoverFlowRef.current;
      if (cur === "idle" || cur.step !== "steal") return;
      const { draft } = cur;
      if (side !== opponentOf(draft.committingSide)) return;
      const active =
        side === "home"
          ? activeRosterRef.current.home
          : activeRosterRef.current.away;
      if (!active.includes(jersey)) return;
      void commitTurnoverLog(draft, { side, jersey });
      setTurnoverFlow("idle");
    },
    [commitTurnoverLog],
  );

  const handleSidePlayerPrimaryClick = useCallback(
    (side: TeamSide, jersey: number) => {
      if (foulPickerOpenRef.current && foulFlowRef.current === "idle") {
        handleFoulPanelPickerSelect(side, { kind: "player", jersey });
        return;
      }

      const activeShot = shotFlowRef.current;
      if (activeShot !== "idle") {
        if (activeShot.step === "pickRebounder") {
          handlePickRebounder(side, jersey);
          return;
        }
        if (activeShot.step === "pickBlocker") {
          handlePickBlocker(side, jersey);
          return;
        }
        if (activeShot.step === "pickShooter") {
          handlePickShooter(side, jersey);
          return;
        }
        if (
          activeShot.step === "assist" &&
          activeShot.draft.side === side &&
          activeShot.draft.shooterJersey !== jersey
        ) {
          handleSelectAssist(jersey);
        }
        return;
      }

      const activeFoul = foulFlowRef.current;
      if (activeFoul !== "idle") {
        if (activeFoul.step === "pickFouler") {
          handleFoulPickFouler(side, jersey);
          return;
        }
        if (activeFoul.step === "pickFouled") {
          const foulerSide = activeFoul.draft.foulerSide;
          if (foulerSide !== null && side === opponentOf(foulerSide)) {
            handleFoulPickFouled(jersey);
          }
          return;
        }
        if (activeFoul.step === "ftAssist") {
          const fs = activeFoul.draft.foulerSide;
          if (fs === null) return;
          const fouledSide = opponentOf(fs);
          if (side !== fouledSide) return;
          const fj = activeFoul.draft.fouledJersey;
          if (fj === null || jersey === fj) return;
          handleFoulFtAssistSelect(jersey);
          return;
        }
        if (activeFoul.step === "rebounder") {
          handleFoulPickRebounder(side, jersey);
        }
        return;
      }

      const activeTurnover = turnoverFlowRef.current;
      if (activeTurnover !== "idle") {
        if (
          activeTurnover.step === "pickPlayer" &&
          side === activeTurnover.draft.committingSide
        ) {
          handleTurnoverPickCommittingPlayer(jersey);
          return;
        }
        if (
          activeTurnover.step === "steal" &&
          side === opponentOf(activeTurnover.draft.committingSide)
        ) {
          handleTurnoverPickStealer(side, jersey);
        }
      }
    },
    [
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
    ],
  );

  const openTimeoutModal = useCallback(() => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      jumpBallModalOpenRef.current ||
      shotFlowRef.current !== "idle" ||
      foulFlowRef.current !== "idle" ||
      turnoverFlowRef.current !== "idle"
    )
      return;
    setTimeoutModalOpen(true);
  }, []);

  const openJumpBallModal = useCallback(() => {
    if (
      foulPickerOpenRef.current ||
      subModalOpenRef.current ||
      timeoutModalOpenRef.current ||
      shotFlowRef.current !== "idle" ||
      foulFlowRef.current !== "idle" ||
      turnoverFlowRef.current !== "idle"
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
      shotFlowRef.current !== "idle" ||
      foulFlowRef.current !== "idle" ||
      turnoverFlowRef.current !== "idle"
    )
      return;
    setSubDraftHome(cloneLineup(homeLineup));
    setSubDraftAway(cloneLineup(awayLineup));
    setSubModalOpen(true);
  }, [homeLineup, awayLineup]);

  const handleSubstitutionFinish = useCallback(() => {
    if (!lineupIsComplete(subDraftHome) || !lineupIsComplete(subDraftAway))
      return;
    const homeDiff = diffLineupOnCourt(homeLineup, subDraftHome);
    const awayDiff = diffLineupOnCourt(awayLineup, subDraftAway);
    // Every command carries the full five-man lineups (not just the swapped pair) so the
    // backend can persist a restorable snapshot — see Backend Gap #10. Each command must carry
    // the lineups *as they stand after that one swap*, not the batch's final target: the
    // backend validates playerOutId is on court and playerInId is not, against the snapshot
    // left by the previous command. Sending the final lineup on every command made the first
    // command apply every swap at once, so the second command's playerOutId was already gone
    // ("not on court") and its playerInId already in ("already on court") — which broke any
    // submit with more than one swap, including one swap per team.
    const runningLineups: Record<TeamSide, string[]> = {
      home: compactOnCourt(homeLineup).map((jersey) =>
        getPlayerId("home", jersey),
      ),
      away: compactOnCourt(awayLineup).map((jersey) =>
        getPlayerId("away", jersey),
      ),
    };
    // One log row per swap, each tied to its own command, so a single swap can be undone (and
    // shows whether it has synced) without touching the others.
    const committedSwaps: Array<{
      side: TeamSide;
      outJersey: number;
      inJersey: number;
      localId: string;
    }> = [];
    void (async () => {
      try {
        const submitTeamSubs = async (
          side: TeamSide,
          diff: { out: number[]; in: number[] },
        ): Promise<boolean> => {
          if (diff.out.length !== diff.in.length) {
            setSyncNotice(
              "Substitution mismatch detected. Keep one-out/one-in pairs per team.",
            );
            return false;
          }
          for (let idx = 0; idx < diff.out.length; idx += 1) {
            const outId = getPlayerId(side, diff.out[idx]);
            const inId = getPlayerId(side, diff.in[idx]);
            runningLineups[side] = runningLineups[side].map((id) =>
              id === outId ? inId : id,
            );
            const committed = await commitEventCommand("substitution", {
              teamId: getTeamIdForSide(side),
              playerOutId: outId,
              playerInId: inId,
              homeLineup: runningLineups.home,
              awayLineup: runningLineups.away,
            });
            if (!committed) {
              setSyncNotice(
                "Couldn't save this substitution — your session may have expired. Try again.",
              );
              return false;
            }
            committedSwaps.push({
              side,
              outJersey: diff.out[idx],
              inJersey: diff.in[idx],
              localId: committed.localId,
            });
          }
          return true;
        };

        if (!(await submitTeamSubs("home", homeDiff))) return;
        if (!(await submitTeamSubs("away", awayDiff))) return;

        for (const swap of committedSwaps) {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: swap.side === "home" ? homeName : awayName,
            player: "—",
            action: "substitution",
            result: `Out ${getPlayerLabel(swap.side, swap.outJersey)} · In ${getPlayerLabel(swap.side, swap.inJersey)}`,
            localId: swap.localId,
            meta: {
              side: swap.side,
              outJersey: swap.outJersey,
              inJersey: swap.inJersey,
            },
          });
        }
        const nextHomeLineup = cloneLineup(subDraftHome);
        const nextAwayLineup = cloneLineup(subDraftAway);
        setHomeLineup(nextHomeLineup);
        setAwayLineup(nextAwayLineup);
        // Persist so a refresh/remount (including resuming an in-progress game) picks up
        // this substitution instead of reverting to the pre-game Starters submission.
        writeStoredLineups({ home: nextHomeLineup, away: nextAwayLineup });
        setSubModalOpen(false);
        setSyncNotice(null);
        setEjectionNotice(null);
      } catch (error) {
        console.error("[StatDash] Substitution finish failed:", error);
        setSyncNotice(
          error instanceof Error
            ? `Substitution failed: ${error.message}`
            : "Substitution failed unexpectedly. Please try again.",
        );
      }
    })();
  }, [
    subDraftHome,
    subDraftAway,
    homeLineup,
    awayLineup,
    appendLog,
    clockLabel,
    commitEventCommand,
    getPlayerId,
    getPlayerLabel,
    getTeamIdForSide,
    periodLabel,
    homeName,
    awayName,
  ]);

  const handleSubstitutionCancel = useCallback(() => {
    setSubModalOpen(false);
    setEjectionNotice(null);
  }, []);

  const handleTimeoutSelect = useCallback(
    (choice: TimeoutChoice) => {
      void (async () => {
        // Official/media timeouts have no owning team, so they omit teamId and use
        // timeoutType "official" (Backend Gap #13 — TimeoutCommandDto.teamId is optional).
        const committed = await commitEventCommand(
          "timeout",
          choice === "officials"
            ? { timeoutType: "official" }
            : { teamId: getTeamIdForSide(choice), timeoutType: "full" },
        );
        if (!committed) return;
        // Linked to the command by localId, like every other play, so the log editor can tell
        // whether it has synced and can undo it.
        const timeoutRow = {
          period: periodLabel,
          clock: clockLabel,
          player: "—",
          action: "timeout",
          localId: committed.localId,
          meta: { choice },
        };
        if (choice === "home") {
          appendLog({ ...timeoutRow, team: homeName, result: "full" });
        } else if (choice === "away") {
          appendLog({ ...timeoutRow, team: awayName, result: "full" });
        } else {
          appendLog({ ...timeoutRow, team: "Officials", result: "official / media" });
        }
        setTimeoutModalOpen(false);
      })();
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      getTeamIdForSide,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  const handleTimeoutModalCancel = useCallback(() => {
    setTimeoutModalOpen(false);
  }, []);

  const handleJumpBallSelect = useCallback(
    (choice: JumpBallChoice) => {
      void (async () => {
        const committed = await commitEventCommand("jump_ball", {
          winningTeamId:
            choice === "home"
              ? (readStoredSessionContext()?.homeTeamId ?? "home_team")
              : (readStoredSessionContext()?.awayTeamId ?? "away_team"),
        });
        if (!committed) return;
        const teamName = choice === "home" ? homeName : awayName;
        appendLog({
          period: periodLabel,
          clock: clockLabel,
          team: teamName,
          player: "—",
          action: "jump ball",
          result: "possession",
          localId: committed.localId,
          meta: { winner: choice },
        });
        setJumpBallModalOpen(false);
        // Start game clock as soon as the jump-ball winner is selected.
        setIsRunning(true);
        setQuarterBreakPending(false);
      })();
    },
    [
      appendLog,
      clockLabel,
      commitEventCommand,
      periodLabel,
      homeName,
      awayName,
    ],
  );

  const handleJumpBallCancel = useCallback(() => {
    setJumpBallModalOpen(false);
  }, []);

  const handleQuarterBreakConfirm = useCallback(() => {
    const nextQuarter = Math.min(4, quarter + 1);
    setQuarter(nextQuarter);
    setTimerSeconds(QUARTER_DURATION_SEC);
    setQuarterBreakPending(false);
    setQuarterEndAwaitingFinish(false);
    setQuarterBreakModalOpen(false);
    // Court overlay only ever shows the current quarter's shots — the full shot history
    // still lives on the backend and is what the post-game shot chart page reads from.
    setCourtShotMarkers([]);
    setCourtFoulMarkers([]);
    void commitEventCommand("clock", {
      period: nextQuarter,
      clockSecondsRemaining: QUARTER_DURATION_SEC,
      isRunning: false,
    });
  }, [commitEventCommand, quarter]);

  const handleQuarterBreakKeepReviewing = useCallback(() => {
    setQuarterBreakModalOpen(false);
    setQuarterEndAwaitingFinish(true);
  }, []);

  const handleQuarterFinishReopen = useCallback(() => {
    if (quarter >= REGULATION_QUARTERS) {
      // Re-check live, not just whatever was true when the period first ended — a
      // correction made while "reviewing" can retie (or untie) the score, and the
      // next prompt must reflect that, not whatever was decided on the first pass.
      if (homeScore === awayScore) {
        setOvertimeModalOpen(true);
      } else {
        setFinishConfirmOpen(true);
      }
    } else {
      setQuarterBreakModalOpen(true);
    }
  }, [quarter, homeScore, awayScore]);

  const handleOvertimeConfirm = useCallback(() => {
    const nextQuarter = Math.min(MAX_PERIOD, quarter + 1);
    const minutes = Math.max(
      1,
      Math.min(
        MAX_TIMER_SECONDS / 60,
        overtimeMinutesDraft || DEFAULT_OVERTIME_MINUTES,
      ),
    );
    const durationSec = Math.round(minutes * 60);
    setQuarter(nextQuarter);
    setTimerSeconds(durationSec);
    setOvertimeModalOpen(false);
    setQuarterEndAwaitingFinish(false);
    // Court overlay only ever shows the current period's shots — the full shot history
    // still lives on the backend and is what the post-game shot chart page reads from.
    setCourtShotMarkers([]);
    setCourtFoulMarkers([]);
    void commitEventCommand("clock", {
      period: nextQuarter,
      clockSecondsRemaining: durationSec,
      isRunning: false,
    });
  }, [commitEventCommand, quarter, overtimeMinutesDraft]);

  const handleOvertimeKeepReviewing = useCallback(() => {
    setOvertimeModalOpen(false);
    setQuarterEndAwaitingFinish(true);
  }, []);

  const handleClearGameLog = useCallback(() => {
    if (!window.confirm("Clear the entire game log? This cannot be undone."))
      return;
    setGameLog([]);
  }, []);

  const handleOpenLogEditor = useCallback(
    (entry: GameLogEntry) => {
      // An "assist" row isn't its own backend event — it's the `assistPlayerId`
      // field on the parent shot command (same localId), split into two log rows
      // purely for display. Editing it as a standalone event sends a
      // differently-shaped correction than the backend expects and silently
      // fails to apply. Always edit the shot (and its assist) together instead.
      // An assist / steal / block row isn't its own play — it belongs to the shot or turnover
      // recorded in the same command (same localId). Open that parent, which carries the field.
      let target = entry;
      if (entry.action === "assist" || entry.action === "steal" || entry.action === "block") {
        // Rows restored from history after a reload have no localId; their companion rows are
        // named after the play they belong to (`replay_<id>_assist`).
        const replayParentId = entry.id.replace(/_(assist|steal|block)$/, "");
        const parent = gameLog.find(
          (row) =>
            (row.action === "shot" || row.action === "turnover") &&
            ((entry.localId && row.localId === entry.localId) ||
              (replayParentId !== entry.id && row.id === replayParentId)),
        );
        if (parent) target = parent;
      }
      setEditingLog(target);
      const draft: Record<string, unknown> = target.meta
        ? { ...target.meta }
        : {};
      // Rows logged before these carried their own details: work them out from the team named.
      if (target.action === "timeout" && draft.choice === undefined) {
        draft.choice =
          target.team === homeName ? "home" : target.team === awayName ? "away" : "officials";
      }
      if (target.action === "jump ball" && draft.winner === undefined) {
        draft.winner = target.team === awayName ? "away" : "home";
      }
      if (target.action === "shot" && target.localId && draft.assistJersey === undefined) {
        const companionAssist = gameLog.find(
          (row) => row.action === "assist" && row.localId === target.localId,
        );
        draft.assistJersey = companionAssist?.meta?.assistJersey ?? "none";
      }
      setEditDraft(draft);
      setEditInitial(draft);
    },
    [gameLog, homeName, awayName],
  );

  const handleCloseLogEditor = useCallback(() => {
    setEditingLog(null);
    setEditDraft({});
    setEditInitial({});
  }, []);

  // ---- Editing and undoing plays -----------------------------------------------------------------
  // Both are local-first: the log, scoreboard, court and lineups change the instant the statistician
  // confirms, and whatever the server needs is sent in the background through the same ordered queue
  // as everything else. Nothing here waits for a play to finish syncing.

  const correctionCtx = useMemo<CorrectionContext>(
    () => ({
      getPlayerId,
      getTeamIdForSide,
      isThreePointer: (x, y, side) =>
        isCourtClickThreePointer(x, y, side, homeAttacksLeft),
      shotTypeToApiType: (t) =>
        shotTypeToApiType(t as Parameters<typeof shotTypeToApiType>[0]),
      foulTypeToApiType: (t) => foulTypeToApiType(t as FoulTypeId),
    }),
    [getPlayerId, getTeamIdForSide, homeAttacksLeft],
  );

  const nudgeScore = useCallback((delta: { home: number; away: number }) => {
    if (delta.home !== 0) setHomeScore((v) => Math.max(0, v + delta.home));
    if (delta.away !== 0) setAwayScore((v) => Math.max(0, v + delta.away));
  }, []);

  /** Rewrites the log rows of an edited play so they read exactly like a freshly recorded one. */
  const rebuildRowsAfterEdit = useCallback(
    (
      rows: GameLogEntry[],
      entry: GameLogEntry,
      draft: Record<string, unknown>,
    ): GameLogEntry[] => {
      const action = entry.action;
      const withMeta = (row: GameLogEntry, patch: Record<string, unknown>) => ({
        ...row,
        meta: { ...(row.meta ?? {}), ...patch },
      });

      if (action === "shot") {
        const side = draft.side as TeamSide;
        const made = draft.result !== "missed";
        const value = shotValueFor(draft, side, correctionCtx);
        const shooterJersey = draft.shooterJersey as number;
        const resultText =
          value === 3
            ? `3pt ${made ? "made" : "missed"}`
            : shotTypeResultPhrase(
                draft.shotType as Parameters<typeof shotTypeResultPhrase>[0],
                made ? "made" : "missed",
              );
        const assistJersey =
          made && typeof draft.assistJersey === "number"
            ? draft.assistJersey
            : null;
        const next: GameLogEntry[] = [];
        let assistSeen = false;
        for (const row of rows) {
          if (row.id === entry.id) {
            next.push({
              ...withMeta(row, {
                shooterJersey,
                shotValue: value,
                result: made ? "made" : "missed",
              }),
              player: getPlayerLabel(side, shooterJersey),
              result: resultText,
            });
            if (assistJersey !== null && !rows.some((r) => r.action === "assist" && r.localId === entry.localId)) {
              // The play gained an assist: add its row under the shot, like a newly recorded one.
              next.push({
                id: newLogId(),
                localId: entry.localId,
                period: entry.period,
                clock: entry.clock,
                team: entry.team,
                player: getPlayerLabel(side, assistJersey),
                action: "assist",
                result: `To ${getPlayerLabel(side, shooterJersey)}`,
                meta: { side, assistJersey, assistedJersey: shooterJersey },
              });
            }
            continue;
          }
          if (row.action === "assist" && entry.localId && row.localId === entry.localId) {
            assistSeen = true;
            if (assistJersey === null) continue; // assist removed
            next.push({
              ...withMeta(row, { assistJersey, assistedJersey: shooterJersey }),
              player: getPlayerLabel(side, assistJersey),
              result: `To ${getPlayerLabel(side, shooterJersey)}`,
            });
            continue;
          }
          next.push(row);
        }
        void assistSeen;
        return next;
      }

      return rows.map((row) => {
        if (row.id !== entry.id) return row;
        if (action === "substitution") {
          const side = draft.side as TeamSide;
          const outJersey = draft.outJersey as number;
          const inJersey = draft.inJersey as number;
          return {
            ...withMeta(row, { outJersey, inJersey }),
            result: `Out ${getPlayerLabel(side, outJersey)} · In ${getPlayerLabel(side, inJersey)}`,
          };
        }
        if (action === "timeout") {
          const choice = draft.choice as TeamSide | "officials";
          return {
            ...withMeta(row, { choice }),
            team: choice === "home" ? homeName : choice === "away" ? awayName : "Officials",
            result: choice === "officials" ? "official / media" : "full",
          };
        }
        if (action === "jump ball") {
          const winner = draft.winner as TeamSide;
          return {
            ...withMeta(row, { winner }),
            team: winner === "home" ? homeName : awayName,
          };
        }
        if (action === "foul") {
          const foulerSide = draft.foulerSide as TeamSide;
          const fouledSide = opponentOf(foulerSide);
          const foulerJersey = draft.foulerJersey as number;
          const fouledJersey = draft.fouledJersey as number | undefined;
          const technical = draft.foulType === "technical";
          return {
            ...withMeta(row, { foulerJersey, fouledJersey: technical ? null : fouledJersey }),
            player: getPlayerLabel(foulerSide, foulerJersey),
            result: technical
              ? "Technical foul"
              : `${foulTypeLabel(draft.foulType as FoulTypeId)} on ${fouledSide === "home" ? homeName : awayName} ${getPlayerLabel(fouledSide, fouledJersey as number)}`,
          };
        }
        if (action === "free throw") {
          const side = draft.shooterSide as TeamSide;
          const jersey = draft.shooterJersey as number;
          const made = draft.result !== "missed";
          return {
            ...withMeta(row, { shooterJersey: jersey, result: made ? "made" : "missed" }),
            player: getPlayerLabel(side, jersey),
            result: `${made ? "Made" : "Missed"} (${String(draft.attempt)}/${String(draft.totalAttempts)})`,
          };
        }
        if (action === "turnover") {
          const side = draft.side as TeamSide;
          const jersey = draft.jersey as number;
          return { ...withMeta(row, { jersey }), player: getPlayerLabel(side, jersey) };
        }
        if (action === "rebound") {
          const side = draft.side as TeamSide;
          const jersey = draft.jersey as number;
          const offensive = draft.reboundType === "offensive";
          return {
            ...withMeta(row, { jersey, reboundType: offensive ? "offensive" : "defensive" }),
            player: getPlayerLabel(side, jersey),
            result: offensive ? "Off Rebound" : "Def Rebound",
          };
        }
        return row;
      });
    },
    [correctionCtx, getPlayerLabel, homeName, awayName],
  );

  const handleSaveLogEdit = useCallback(() => {
    if (editingLog === null) return;
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    const action = editingLog.action;

    if (action === "substitution") {
      // Changing who came on/off = take the original swap back, then make the new one, sent as ONE
      // lineup-only command. Each substitution command carries the whole lineup, so patching or
      // dropping one in the middle of the queue would leave later ones inconsistent; a lineup
      // command that states the correct final lineup can't conflict with anything before it.
      const side = editDraft.side as TeamSide;
      const originalOut = editingLog.meta?.outJersey as number;
      const originalIn = editingLog.meta?.inJersey as number;
      const nextOut = editDraft.outJersey as number;
      const nextIn = editDraft.inJersey as number;
      const current = side === "home" ? homeLineup : awayLineup;
      const options = substitutionEditOptions(
        { outJersey: originalOut, inJersey: originalIn },
        compactOnCourt(current),
        fullRoster(current),
      );
      if (!options.ok) {
        setSyncNotice(options.reason);
        return;
      }
      if (!options.outOptions.includes(nextOut) || !options.inOptions.includes(nextIn)) {
        setSyncNotice("Those players can't be swapped at this point in the game.");
        return;
      }
      const finalLineup = swapPlayers(swapPlayers(current, originalIn, originalOut), nextOut, nextIn);
      const home = side === "home" ? finalLineup : homeLineup;
      const away = side === "away" ? finalLineup : awayLineup;
      setHomeLineup(home);
      setAwayLineup(away);
      writeStoredLineups({ home, away });
      void commitEventCommand("substitution", {
        teamId: getTeamIdForSide(side),
        homeLineup: compactOnCourt(home).map((j) => getPlayerId("home", j)),
        awayLineup: compactOnCourt(away).map((j) => getPlayerId("away", j)),
      });
      setGameLog((prev) => rebuildRowsAfterEdit(prev, editingLog, editDraft));
      setEditingLog(null);
      setEditDraft({});
      setEditInitial({});
      setSyncNotice(null);
      return;
    }

    const queued = editingLog.localId
      ? getQueue().find(
          (q) => q.localId === editingLog.localId && (q.kind ?? "command") === "command",
        )
      : undefined;
    // A play restored after a reload has no queued command; its recorded payload rides on the row.
    const restoredPayload = editingLog.meta?.originalPayload as Record<string, unknown> | undefined;
    const corrected = buildCorrectedPayload(
      action,
      editDraft,
      queued?.payload ?? restoredPayload,
      correctionCtx,
    );
    if (!corrected) {
      setSyncNotice("This kind of play can't be edited. Undo it and record it again.");
      return;
    }

    if (queued && (queued.status === "pending" || queued.status === "failed")) {
      // Not sent yet (or rejected): fix the command itself, so the server only ever sees the
      // corrected version. A rejected one gets another go now that it has changed.
      const merged: Record<string, unknown> = {
        ...queued.payload,
        ...toCommandPayload(action, corrected),
      };
      for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key];
      updateEvent(queued.localId, {
        payload: merged,
        status: "pending",
        attempts: 0,
        lastError: undefined,
      });
    } else {
      const targetBackendEventId = editingLog.backendEventId ?? queued?.backendEventIds?.[0];
      if (!queued && !targetBackendEventId) {
        setSyncNotice("Couldn't find this play on the server to change it. Undo it and record it again.");
        return;
      }
      enqueue({
        sessionId: context.sessionId,
        commandType: "correct",
        kind: "correct",
        payload: {},
        expectedVersion: latestVersionRef.current,
        correctedPayload: corrected,
        targetLocalId: queued?.localId,
        targetBackendEventId,
        reason: "Corrected from StatDash",
      });
    }

    nudgeScore(
      editScoreDelta(pointsOf(editingLog), draftPoints(action, editDraft, correctionCtx)),
    );
    setGameLog((prev) => rebuildRowsAfterEdit(prev, editingLog, editDraft));
    if (action === "shot" && typeof editDraft.x === "number" && typeof editDraft.y === "number") {
      const kind = editDraft.result === "missed" ? "missed" : "made";
      setCourtShotMarkers((prev) =>
        prev.map((m) =>
          Math.abs(m.nx - (editDraft.x as number)) < 1e-6 && Math.abs(m.ny - (editDraft.y as number)) < 1e-6
            ? { ...m, kind }
            : m,
        ),
      );
    }
    setEditingLog(null);
    setEditDraft({});
    setEditInitial({});
    setSyncNotice(null);
  }, [
    awayLineup,
    commitEventCommand,
    correctionCtx,
    editDraft,
    editingLog,
    enqueue,
    getPlayerId,
    getQueue,
    getTeamIdForSide,
    homeLineup,
    navigate,
    nudgeScore,
    rebuildRowsAfterEdit,
    updateEvent,
  ]);

  const handleUndoLogEntry = useCallback(() => {
    if (editingLog === null) return;
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    const plan = planUndo(editingLog, gameLogRef.current, getQueue());

    let nextHome: TeamLineup | null = null;
    let nextAway: TeamLineup | null = null;
    if (plan.substitution) {
      const { swap } = plan.substitution;
      const current = swap.side === "home" ? homeLineup : awayLineup;
      const check = canSwapBack(swap, compactOnCourt(current));
      if (!check.ok) {
        setSyncNotice(check.reason);
        return;
      }
      const swapped = swapPlayers(current, swap.outJersey, swap.inJersey);
      if (swap.side === "home") nextHome = swapped;
      else nextAway = swapped;
    }

    // 1. Commands the server never got: just drop them.
    for (const id of plan.cancelLocalIds) discardEvent(id);
    // 2. Plays the server has (or is about to have): reverse them, queued behind whatever they undo.
    for (const r of plan.reversals) {
      enqueue({
        sessionId: context.sessionId,
        commandType: "reverse",
        kind: "reverse",
        payload: {},
        expectedVersion: latestVersionRef.current,
        targetLocalId: r.targetLocalId,
        targetBackendEventId: r.targetBackendEventId,
        reason: "Undone from StatDash",
      });
    }
    // 3. A substitution is undone by swapping the players back — reversing the event would not
    //    restore who is on the court.
    if (plan.substitution && (nextHome || nextAway)) {
      const home = nextHome ?? homeLineup;
      const away = nextAway ?? awayLineup;
      setHomeLineup(home);
      setAwayLineup(away);
      writeStoredLineups({ home, away });
      if (!plan.substitution.cancelOnly) {
        const { swap } = plan.substitution;
        void commitEventCommand("substitution", {
          teamId: getTeamIdForSide(swap.side),
          homeLineup: compactOnCourt(home).map((j) => getPlayerId("home", j)),
          awayLineup: compactOnCourt(away).map((j) => getPlayerId("away", j)),
        });
      }
    }
    // 4. Everything the statistician sees, immediately.
    const removed = new Set(plan.removeRowIds);
    const removedShots = gameLogRef.current.filter(
      (r) => removed.has(r.id) && r.action === "shot" && typeof r.meta?.x === "number" && typeof r.meta?.y === "number",
    );
    setGameLog((prev) => prev.filter((r) => !removed.has(r.id)));
    nudgeScore(plan.scoreDelta);
    if (removedShots.length > 0) {
      setCourtShotMarkers((prev) =>
        prev.filter(
          (m) =>
            !removedShots.some(
              (r) =>
                Math.abs(m.nx - (r.meta!.x as number)) < 1e-6 &&
                Math.abs(m.ny - (r.meta!.y as number)) < 1e-6,
            ),
        ),
      );
    }
    setEditingLog(null);
    setEditDraft({});
    setEditInitial({});
    setSyncNotice(`${actionTitle(editingLog.action)} undone.`);
  }, [
    awayLineup,
    commitEventCommand,
    discardEvent,
    editingLog,
    enqueue,
    getPlayerId,
    getQueue,
    getTeamIdForSide,
    homeLineup,
    navigate,
    nudgeScore,
  ]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]'))
        return;

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
      if (overtimeModalOpen) {
        e.preventDefault();
        setOvertimeModalOpen(false);
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
      if (shotFlowRef.current !== "idle") {
        e.preventDefault();
        handleModalCancel();
        return;
      }
      if (foulFlowRef.current !== "idle") {
        e.preventDefault();
        handleFoulFlowCancel();
        return;
      }
      if (turnoverFlowRef.current !== "idle") {
        e.preventDefault();
        handleTurnoverFlowCancel();
        return;
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    editingLog,
    subModalOpen,
    quarterBreakModalOpen,
    overtimeModalOpen,
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
      className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden text-gray-900"
      style={{ fontFamily: STAT_DASH.fontStack, background: STAT_DASH.pageBg }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/starters-bg.jpg')",
          opacity: 0.22,
          filter: "blur(28px)",
          transform: "scale(1.08)",
        }}
      />
      <StatisticianFullscreenGate />
      <MenuBar
        onSwitchTeamSide={() => setSwitchSidesOpen(true)}
        onStarters={() => setStartersModalOpen(true)}
        onClearGameLog={handleClearGameLog}
        sessionStatus={sessionStatus}
        onPauseResume={handlePauseResume}
        pauseInFlight={isTogglingPause}
        onFinishMatch={() => setFinishConfirmOpen(true)}
        onCancelGame={() => setCancelConfirmOpen(true)}
        realtimeConnected={realtimeConnected}
        realtimeReconnecting={realtimeReconnecting}
        isOnline={isOnline}
        failedCount={failedCount}
        pendingCount={pendingCount}
        onRetryFailed={retryFailed}
        isBootstrapping={isBootstrapping}
      />

      <EdgeTeamDrawer
        edge="left"
        teamName={homeOnLeft ? homeName : awayName}
        teamColor={homeOnLeft ? homeTeamColor : awayTeamColor}
        roster={homeOnLeft ? homeMatchRosterNumbers : awayMatchRosterNumbers}
        rosterByJersey={homeOnLeft ? homeRosterByJersey : awayRosterByJersey}
        entries={gameLog}
        open={activeDrawer === "left"}
        onClose={() => setActiveDrawer(null)}
      />
      <EdgeTeamDrawer
        edge="right"
        teamName={homeOnLeft ? awayName : homeName}
        teamColor={homeOnLeft ? awayTeamColor : homeTeamColor}
        roster={homeOnLeft ? awayMatchRosterNumbers : homeMatchRosterNumbers}
        rosterByJersey={homeOnLeft ? awayRosterByJersey : homeRosterByJersey}
        entries={gameLog}
        open={activeDrawer === "right"}
        onClose={() => setActiveDrawer(null)}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {syncNotice && (
          <div className="absolute left-1/2 top-3 z-[260] flex max-w-xl -translate-x-1/2 items-start gap-3 border-2 border-gray-800 bg-gray-900 px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-white">{syncNotice}</p>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="shrink-0 p-0.5 text-gray-300 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              aria-label="Dismiss sync notice"
            >
              ✕
            </button>
          </div>
        )}
        {ejectionNotice && (
          <div className="absolute left-1/2 top-3 z-[260] flex max-w-xl -translate-x-1/2 items-start gap-3 border-2 border-red-300 bg-red-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-red-800">
              {ejectionNotice}
            </p>
            <button
              type="button"
              onClick={() => setEjectionNotice(null)}
              className="shrink-0 p-0.5 text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Dismiss ejection notice"
            >
              ✕
            </button>
          </div>
        )}
        <div className="m-5 flex min-h-0 min-w-0 flex-1 overflow-hidden border border-gray-200 bg-white">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-6 py-3 sm:px-10 sm:py-4">
            <GameCenter
              headerSlot={
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
                  // Finish only makes sense once the clock has actually run out — if the
                  // statistician adds time back after a period nominally ended (forgot to
                  // stop it, needs to log a late play), normal Start/Stop must take back
                  // over instead of staying stuck on Finish with no way to run the clock.
                  showQuarterFinish={quarterEndAwaitingFinish && timerSeconds === 0}
                  onQuarterFinish={handleQuarterFinishReopen}
                />
              }
              homeColor={homeTeamColor}
              awayColor={awayTeamColor}
              homeActivePlayers={homePanelNumbers}
              awayActivePlayers={awayPanelNumbers}
              onPlayerFoulClick={handleSidePlayerPrimaryClick}
              onPlayerShotContextMenu={(side, jersey) =>
                openShotFlowFromPlayer(side, jersey)
              }
              onFoul={openFoulFlowFromPanelFoulButton}
              onTurnover={openTurnoverFlowFromPanel}
              onCourtFoulClick={(e) => openShotFlowFromCourt(e, "missed")}
              onCourtShotContextMenu={(e) => openShotFlowFromCourt(e, "made")}
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
              onTurnoverPickCommittingPlayer={
                handleTurnoverPickCommittingPlayer
              }
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
              onToggleRoster={(side) => {
                const edge =
                  (side === "home") === homeOnLeft ? "left" : "right";
                setActiveDrawer((cur) => (cur === edge ? null : edge));
              }}
              activeRosterSide={
                activeDrawer === null
                  ? null
                  : (activeDrawer === "left") === homeOnLeft
                    ? "home"
                    : "away"
              }
            />
            {subModalOpen && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="flex max-h-full w-full max-w-[min(100%,760px)] px-3 py-1 sm:px-4 sm:py-2">
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

          <div className="flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white sm:w-[340px]">
            <div
              className="shrink-0 bg-[#111827] px-4 py-2.5 text-xs font-bold uppercase text-white"
              style={{ letterSpacing: 1.5 }}
            >
              Game Log
            </div>
            <GameLog entries={gameLog} onRowClick={handleOpenLogEditor} />
          </div>
        </div>
      </div>

      {quarterBreakModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
            <h3 className="text-base font-bold text-gray-900">Quarter ended</h3>
            <p className="mt-2 text-sm text-gray-700">
              Have you finished adding all data for this quarter?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleQuarterBreakKeepReviewing}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={handleQuarterBreakConfirm}
                className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Yes, next quarter
              </button>
            </div>
          </div>
        </div>
      )}

      {overtimeModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
            <h3 className="text-base font-bold text-gray-900">
              {quarter === REGULATION_QUARTERS
                ? "Game tied after regulation"
                : `Still tied after ${formatPeriodLabel(quarter)}`}
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              {homeName} {homeScore} – {awayScore} {awayName}. Have you finished
              adding all data for this period?
            </p>
            <div className="mt-3 flex items-center gap-2">
              <label
                htmlFor="overtime-minutes"
                className="text-sm font-medium text-gray-700"
              >
                Overtime length
              </label>
              <input
                id="overtime-minutes"
                type="number"
                min={1}
                max={MAX_TIMER_SECONDS / 60}
                value={overtimeMinutesDraft}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setOvertimeMinutesDraft(
                    Number.isFinite(parsed)
                      ? Math.max(1, Math.min(MAX_TIMER_SECONDS / 60, parsed))
                      : DEFAULT_OVERTIME_MINUTES,
                  );
                }}
                className="w-16 border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              />
              <span className="text-sm text-gray-600">
                minutes (up to {MAX_TIMER_SECONDS / 60})
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleOvertimeKeepReviewing}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={handleOvertimeConfirm}
                className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Start overtime
              </button>
            </div>
          </div>
        </div>
      )}

      {startGamePromptOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
            <h3 className="text-base font-bold text-gray-900">Start game?</h3>
            <p className="mt-2 text-sm text-gray-700">
              Jump ball is set. Do you want to start the game clock now?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleStartGamePromptSkip}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={isStartingGame}
                onClick={handleStartGamePromptConfirm}
                className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {isStartingGame ? "Starting…" : "Start game"}
              </button>
            </div>
          </div>
        </div>
      )}

      {finishConfirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
            <h3 className="text-base font-bold text-gray-900">Finish match?</h3>
            <p className="mt-2 text-sm text-gray-700">
              This marks the game as completed. You won't be able to record any
              more events for this match afterward.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFinishConfirmOpen(false);
                  // "Not yet" — keep the yellow Finish button reachable so the
                  // statistician can add a late correction/event, then re-decide
                  // (re-tied score routes back to Overtime instead, live).
                  setQuarterEndAwaitingFinish(true);
                }}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Not yet
              </button>
              <button
                type="button"
                disabled={isFinishingSession}
                onClick={handleFinishMatchConfirm}
                className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {isFinishingSession ? "Finishing…" : "Finish match"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirmOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
            <h3 className="text-base font-bold text-gray-900">
              Cancel this game?
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              This marks the game as cancelled. This cannot be undone from here
              — the match will need to be reopened by an admin.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Stay
              </button>
              <button
                type="button"
                disabled={isCancellingSession}
                onClick={handleCancelMatchConfirm}
                className="bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                {isCancellingSession ? "Cancelling…" : "Cancel game"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog &&
        (() => {
          const entry = editingLog;
          const action = entry.action;

          // Who could have made this play: whoever was on the court for that side at the moment it
          // happened (stamped when it was logged) — you can't shoot, rebound or steal from the
          // bench. Older entries without that snapshot fall back to the full roster, and the play's
          // own player always stays selectable.
          const playersFor = (
            side: TeamSide | undefined,
            current: unknown,
          ): number[] => {
            if (!side) return [];
            const snapshot =
              side === "home"
                ? (entry.meta?.onCourtHome as number[] | undefined)
                : (entry.meta?.onCourtAway as number[] | undefined);
            const roster = side === "home" ? homeRosterList : awayRosterList;
            // Plays restored after a reload carry no snapshot: use who is on the court now — most
            // likely right — and let the statistician reach anyone else from "Bench".
            const nowOnCourt = compactOnCourt(
              side === "home" ? homeLineup : awayLineup,
            );
            const base =
              snapshot && snapshot.length > 0
                ? snapshot
                : nowOnCourt.length > 0
                  ? nowOnCourt
                  : roster;
            const withCurrent =
              typeof current === "number" && !base.includes(current)
                ? [...base, current]
                : base;
            return [...withCurrent].sort((a, b) => a - b);
          };

          const editSide = (editDraft.side ??
            editDraft.foulerSide ??
            editDraft.shooterSide) as TeamSide | undefined;
          const shotValue =
            action === "shot" && editSide
              ? shotValueFor(editDraft, editSide, correctionCtx)
              : 2;
          const hasShotPosition =
            typeof editDraft.x === "number" && typeof editDraft.y === "number";
          const dirty = isDraftDirty(action, editInitial, editDraft);
          const plan = planUndo(entry, gameLog, queue);
          let substitutionOptions: ReturnType<typeof substitutionEditOptions> | undefined;
          if (
            action === "substitution" &&
            (entry.meta?.side === "home" || entry.meta?.side === "away") &&
            typeof entry.meta?.outJersey === "number" &&
            typeof entry.meta?.inJersey === "number"
          ) {
            const lineup = entry.meta.side === "home" ? homeLineup : awayLineup;
            substitutionOptions = substitutionEditOptions(
              { outJersey: entry.meta.outJersey, inJersey: entry.meta.inJersey },
              compactOnCourt(lineup),
              fullRoster(lineup),
            );
          }
          let undoBlockedReason: string | undefined;
          if (plan.substitution) {
            const current =
              plan.substitution.swap.side === "home" ? homeLineup : awayLineup;
            const check = canSwapBack(
              plan.substitution.swap,
              compactOnCourt(current),
            );
            if (!check.ok) undoBlockedReason = check.reason;
          }

          return (
            <LogEditorModal
              entry={entry}
              draft={editDraft}
              onDraftChange={setEditDraft}
              dirty={dirty}
              sync={syncStateFor(entry, queue)}
              teamNames={{ home: homeName, away: awayName }}
              getPlayerLabel={getPlayerLabel}
              playersFor={playersFor}
              rosterFor={(side) =>
                side === "home"
                  ? homeRosterList
                  : side === "away"
                    ? awayRosterList
                    : []
              }
              shotValue={shotValue}
              hasShotPosition={hasShotPosition}
              foulTypeLabel={(id) => foulTypeLabel(id as FoulTypeId)}
              turnoverTypeLabel={(id) => turnoverTypeLabel(id as TurnoverTypeId)}
              scoreChange={
                dirty
                  ? editScoreDelta(
                      pointsOf(entry),
                      draftPoints(action, editDraft, correctionCtx),
                    )
                  : { home: 0, away: 0 }
              }
              undoDescription={describeUndo(entry, plan, {
                home: homeName,
                away: awayName,
              })}
              undoBlockedReason={undoBlockedReason}
              substitution={substitutionOptions}
              onSave={handleSaveLogEdit}
              onUndo={handleUndoLogEntry}
              onClose={handleCloseLogEditor}
            />
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
          // Persist so a refresh/resume keeps the switched sides (previously this only lived in
          // React state and silently reverted to the pre-game choice on reload).
          const sessionId = readStoredSessionContext()?.sessionId;
          writeGameSetupOrientation(next, sessionId);
          if (sessionId) {
            void sessionsApi
              .updateOrientation(sessionId, next)
              .catch(() =>
                setSyncNotice("Couldn't save the side switch to the server."),
              );
          }
        }}
      />

      <StartersModal
        open={startersModalOpen}
        onClose={() => setStartersModalOpen(false)}
        homeLineup={homeLineup}
        awayLineup={awayLineup}
        homePlayers={
          homePlayersForStartersModal.length > 0
            ? homePlayersForStartersModal
            : undefined
        }
        awayPlayers={
          awayPlayersForStartersModal.length > 0
            ? awayPlayersForStartersModal
            : undefined
        }
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
