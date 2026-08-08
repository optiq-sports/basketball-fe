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
import StatusStrip from "./components/StatusStrip";
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
import {
  STAT_DASH,
  STAT_DASH_MAIN_INNER,
  STAT_DASH_MAIN_OUTER,
} from "./statDashTheme";
import type { GameLogEntry, TeamSide } from "./types";
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
import type { TeamLineup } from "./substitutionLineupUtils";
import {
  cloneLineup,
  compactOnCourt,
  DEFAULT_TEAM_LINEUP,
  diffLineupOnCourt,
  formatSubstitutionDiff,
  fullRoster,
  lineupIsComplete,
} from "./substitutionLineupUtils";
import { readGameSetupOrientation } from "../gameSetupOrientation";
import { clearJumpBallWinner, readJumpBallWinner } from "../jumpBallWinner";
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
/** Upper bound for manual clock adjustment (seconds). */
const MAX_TIMER_SECONDS = 60 * 60;

type ShotFlowState = "idle" | ActiveShotFlow;
type FoulFlowState = "idle" | ActiveFoulFlow;
type TurnoverFlowState = "idle" | ActiveTurnoverFlow;

function newLogId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
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
  const {
    dotClassName,
    blink,
    textClassName = "text-xs text-gray-700",
    children,
  } = props;
  return (
    <div className={`flex items-center gap-2 px-4 pt-2 ${textClassName}`}>
      <span
        className={`inline-block size-2 shrink-0 rounded-full ${dotClassName} ${
          blink ? "motion-safe:animate-status-dot-blink" : ""
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
  const [editingLog, setEditingLog] = useState<GameLogEntry | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [isReconcilingLog, setIsReconcilingLog] = useState(false);
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

  const clockLabel = formatClock(timerSeconds);
  const periodLabel = `Q${quarter}`;

  const appendLog = useCallback((row: Omit<GameLogEntry, "id">) => {
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
    setIsRunning(state.status === "IN_PROGRESS");
  }, []);

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

  const { enqueue, queue, pendingCount, failedCount, isOnline, retryFailed } =
    useEventQueue({
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
    ): Promise<(CommandAcceptedResponse & { localId: string }) | null> => {
      const context = readStoredSessionContext();
      if (!context) {
        navigate("/match-key", { replace: true });
        return null;
      }
      const idempotencyKey = generateIdempotencyKey();
      const expectedVersion = readStoredExpectedVersion();

      writeStoredExpectedVersion(expectedVersion + 1);
      latestVersionRef.current = expectedVersion + 1;

      // Every event carries when in the game it happened — otherwise the backend has no
      // way to reconstruct "what quarter/clock was this at" after the fact (see Backend
      // Gap #6 and #11 in docs/BACKEND_GAPS.md). The `clock` command sets these as its own
      // target values with different meaning (where the clock is going), so it's excluded.
      const payloadWithClock =
        commandType === "clock"
          ? payload
          : { period: quarter, clockSecondsRemaining: timerSeconds, ...payload };

      enqueue({
        sessionId: context.sessionId,
        commandType,
        payload: payloadWithClock,
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
    [enqueue, homeScore, awayScore, navigate, quarter, timerSeconds],
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
        writeStoredExpectedVersion(snapshot.version);
        latestVersionRef.current = snapshot.version;
        const winner = readJumpBallWinner();
        if (winner && snapshot.status !== "IN_PROGRESS") {
          setStartGamePromptOpen(true);
          setQuarterBreakPending(false);
        }
        clearJumpBallWinner();
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
            color:
              s.teamId === context.homeTeamId ? homeTeamColor : awayTeamColor,
            kind: s.result === "made" ? ("made" as const) : ("missed" as const),
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
        applyAuthoritativeState(latest);
        latestVersionRef.current = latest.version;
        writeStoredExpectedVersion(latest.version);
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
              applyAuthoritativeState(latest);
              latestVersionRef.current = latest.version;
              writeStoredExpectedVersion(latest.version);
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

  const onAdjustMinutes = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(MAX_TIMER_SECONDS, timerSeconds + delta));
      setTimerSeconds(next);
      void commitEventCommand("clock", {
        quarter,
        clockSecondsRemaining: next,
        isRunning,
      });
    },
    [commitEventCommand, timerSeconds, quarter, isRunning],
  );

  const onAdjustSeconds = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(MAX_TIMER_SECONDS, timerSeconds + delta));
      setTimerSeconds(next);
      void commitEventCommand("clock", {
        quarter,
        clockSecondsRemaining: next,
        isRunning,
      });
    },
    [commitEventCommand, timerSeconds, quarter, isRunning],
  );

  const onStartStop = useCallback(() => {
    const next = !isRunning;
    setIsRunning(next);
    void commitEventCommand("clock", {
      quarter,
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
      // Bench/coach fouls: backend requires foulerPlayerId so we can't submit them
      let committed = null;
      if (draft.foulerRole === "player") {
        committed = await commitEventCommand("foul", {
          teamId: draft.foulerSide
            ? getTeamIdForSide(draft.foulerSide)
            : undefined,
          foulerPlayerId:
            draft.foulerSide && typeof draft.foulerJersey === "number"
              ? getPlayerId(draft.foulerSide, draft.foulerJersey)
              : undefined,
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
      }
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
      void (async () => {
        const cmd = await commitEventCommand("free_throw", {
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
        });
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
        const putbackType = shotType === "dunk" ? "putback-dunk" : "putback-layup";

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
    const summary = `${formatSubstitutionDiff(homeName, homeDiff)} · ${formatSubstitutionDiff(awayName, awayDiff)}`;
    // Full resulting five-man lineups (not just the swapped pair) so the backend can persist
    // a restorable snapshot — see Backend Gap #10. Same target lineup on every command in this
    // batch since subDraftHome/subDraftAway don't change until the whole submission completes.
    const homeLineupIds = compactOnCourt(subDraftHome).map((jersey) =>
      getPlayerId("home", jersey),
    );
    const awayLineupIds = compactOnCourt(subDraftAway).map((jersey) =>
      getPlayerId("away", jersey),
    );
    void (async () => {
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
          const committed = await commitEventCommand("substitution", {
            teamId: getTeamIdForSide(side),
            playerOutId: getPlayerId(side, diff.out[idx]),
            playerInId: getPlayerId(side, diff.in[idx]),
            homeLineup: homeLineupIds,
            awayLineup: awayLineupIds,
          });
          if (!committed) return false;
        }
        return true;
      };

      if (!(await submitTeamSubs("home", homeDiff))) return;
      if (!(await submitTeamSubs("away", awayDiff))) return;

      appendLog({
        period: periodLabel,
        clock: clockLabel,
        team: "—",
        player: "—",
        action: "substitution",
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
      setEjectionNotice(null);
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
    setEjectionNotice(null);
  }, []);

  const handleTimeoutSelect = useCallback(
    (choice: TimeoutChoice) => {
      void (async () => {
        // Official timeouts have no owning team — backend requires teamId so we skip the command
        if (choice !== "officials") {
          const committed = await commitEventCommand("timeout", {
            teamId: getTeamIdForSide(choice),
            timeoutType: "full",
          });
          if (!committed) return;
        }
        if (choice === "home") {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: homeName,
            player: "—",
            action: "timeout",
            result: "full",
          });
        } else if (choice === "away") {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: awayName,
            player: "—",
            action: "timeout",
            result: "full",
          });
        } else {
          appendLog({
            period: periodLabel,
            clock: clockLabel,
            team: "Officials",
            player: "—",
            action: "timeout",
            result: "official / media",
          });
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
      quarter: nextQuarter,
      clockSecondsRemaining: QUARTER_DURATION_SEC,
      isRunning: false,
    });
  }, [commitEventCommand, quarter]);

  const handleQuarterBreakKeepReviewing = useCallback(() => {
    setQuarterBreakModalOpen(false);
    setQuarterEndAwaitingFinish(true);
  }, []);

  const handleQuarterFinishReopen = useCallback(() => {
    setQuarterBreakModalOpen(true);
  }, []);

  const handleClearGameLog = useCallback(() => {
    if (!window.confirm("Clear the entire game log? This cannot be undone."))
      return;
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
      setSyncNotice("Waiting for sync confirmation. Try again in a moment.");
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    setIsReconcilingLog(true);
    void (async () => {
      try {
        let correctedPayload: Record<string, unknown>;
        const action = editingLog.action;
        if (action === "shot") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(
              side,
              editDraft.shooterJersey as number,
            ),
            shotValue: editDraft.shotValue as number,
            result: editDraft.result as string,
            ...(editDraft.x != null ? { x: editDraft.x } : {}),
            ...(editDraft.y != null ? { y: editDraft.y } : {}),
          };
        } else if (action === "assist") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.assistJersey as number),
            assistedPlayerId: getPlayerId(
              side,
              editDraft.assistedJersey as number,
            ),
          };
        } else if (action === "foul") {
          const foulerSide = editDraft.foulerSide as TeamSide;
          const fouledSide = opponentOf(foulerSide);
          correctedPayload = {
            teamId: getTeamIdForSide(foulerSide),
            foulerPlayerId:
              typeof editDraft.foulerJersey === "number"
                ? getPlayerId(foulerSide, editDraft.foulerJersey)
                : undefined,
            ...(typeof editDraft.fouledJersey === "number"
              ? {
                  fouledPlayerId: getPlayerId(
                    fouledSide,
                    editDraft.fouledJersey,
                  ),
                }
              : {}),
            foulType: foulTypeToApiType(editDraft.foulType as FoulTypeId),
          };
        } else if (action === "free throw") {
          const side = editDraft.shooterSide as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(
              side,
              editDraft.shooterJersey as number,
            ),
            attempt: editDraft.attempt as number,
            totalAttempts: editDraft.totalAttempts as number,
            result: editDraft.result as string,
          };
        } else if (action === "turnover") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
            turnoverType: editDraft.turnoverType as string,
          };
        } else if (action === "steal") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
          };
        } else if (action === "rebound") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            playerId: getPlayerId(side, editDraft.jersey as number),
            reboundType: editDraft.reboundType as string,
          };
        } else if (action === "block") {
          const side = editDraft.side as TeamSide;
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            blockerPlayerId: getPlayerId(side, editDraft.jersey as number),
          };
        } else {
          setSyncNotice(
            "This event type cannot be edited. Use Reverse to undo it.",
          );
          setIsReconcilingLog(false);
          return;
        }

        const response = await commandsApi.correctEvent(
          editingLog.backendEventId,
          {
            reason: "Corrected from StatDash log editor",
            correctedPayload,
          },
        );
        writeStoredExpectedVersion(response.version);
        latestVersionRef.current = response.version;
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest);
        setEditingLog(null);
        setEditDraft({});
        setSyncNotice("Correction submitted and synced.");
      } catch (error) {
        setSyncNotice(
          error instanceof Error ? error.message : "Failed to correct event.",
        );
      } finally {
        setIsReconcilingLog(false);
      }
    })();
  }, [
    applyAuthoritativeState,
    editDraft,
    editingLog,
    getPlayerId,
    getTeamIdForSide,
    navigate,
  ]);

  const handleReverseEditingLog = useCallback(() => {
    if (editingLog === null) return;
    if (!editingLog.backendEventId) {
      setSyncNotice("Waiting for sync confirmation. Try again in a moment.");
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate("/match-key", { replace: true });
      return;
    }
    setIsReconcilingLog(true);
    void (async () => {
      try {
        const response = await commandsApi.reverseEvent(
          editingLog.backendEventId!,
          {
            reason: "Reversed from StatDash log editor",
          },
        );
        writeStoredExpectedVersion(response.version);
        latestVersionRef.current = response.version;
        const latest = await sessionsApi.getSessionState(context.sessionId);
        applyAuthoritativeState(latest);
        // Remove this entry and any sibling entries sharing the same localId (e.g. foul + FTs)
        setGameLog((prev) =>
          editingLog.localId
            ? prev.filter((e) => e.localId !== editingLog.localId)
            : prev.filter((e) => e.id !== editingLog.id),
        );
        setEditingLog(null);
        setEditDraft({});
        setSyncNotice("Event reversed and synced.");
      } catch (error) {
        setSyncNotice(
          error instanceof Error ? error.message : "Failed to reverse event.",
        );
      } finally {
        setIsReconcilingLog(false);
      }
    })();
  }, [applyAuthoritativeState, editingLog, navigate]);

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
        open={activeDrawer === "left"}
        onToggle={() =>
          setActiveDrawer((cur) => (cur === "left" ? null : "left"))
        }
      />
      <EdgeTeamDrawer
        edge="right"
        teamName={homeOnLeft ? awayName : homeName}
        teamColor={homeOnLeft ? awayTeamColor : homeTeamColor}
        roster={homeOnLeft ? awayMatchRosterNumbers : homeMatchRosterNumbers}
        rosterByJersey={homeOnLeft ? awayRosterByJersey : homeRosterByJersey}
        entries={gameLog}
        open={activeDrawer === "right"}
        onToggle={() =>
          setActiveDrawer((cur) => (cur === "right" ? null : "right"))
        }
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <StatDashStatusLine
          dotClassName={
            realtimeReconnecting
              ? "bg-amber-500"
              : realtimeConnected
                ? "bg-emerald-500"
                : "bg-gray-400"
          }
          blink={realtimeReconnecting}
        >
          {realtimeReconnecting
            ? "Realtime: reconnecting…"
            : realtimeConnected
              ? "Realtime: connected"
              : "Realtime: offline"}
        </StatDashStatusLine>
        <StatDashStatusLine
          dotClassName={
            !isOnline
              ? "bg-orange-500"
              : failedCount > 0
                ? "bg-red-500"
                : pendingCount > 0
                  ? "bg-amber-500"
                  : "bg-emerald-500"
          }
          blink={!isOnline || failedCount > 0 || pendingCount > 0}
        >
          {!isOnline ? (
            "Offline — recording locally"
          ) : failedCount > 0 ? (
            <>
              {failedCount} event(s) failed to sync{" "}
              <button type="button" className="underline" onClick={retryFailed}>
                Retry
              </button>
            </>
          ) : pendingCount > 0 ? (
            <>{pendingCount} event(s) queued</>
          ) : (
            "All events synced"
          )}
        </StatDashStatusLine>
        {isBootstrapping && (
          <StatDashStatusLine
            dotClassName="bg-amber-500"
            blink
            textClassName="text-sm text-gray-600"
          >
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
        {ejectionNotice && (
          <div className="absolute left-1/2 top-3 z-[260] flex max-w-xl -translate-x-1/2 items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold text-red-800">
              {ejectionNotice}
            </p>
            <button
              type="button"
              onClick={() => setEjectionNotice(null)}
              className="shrink-0 rounded p-0.5 text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Dismiss ejection notice"
            >
              ✕
            </button>
          </div>
        )}
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
                {isStartingGame ? "Starting…" : "Start game"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLog &&
        (() => {
          const action = editingLog.action;
          const hasSyncId = Boolean(editingLog.backendEventId);
          // Determine team side from meta for player roster lookups
          const editSide = (editDraft.side ?? editDraft.foulerSide) as
            | TeamSide
            | undefined;
          const editRosterNums =
            editSide === "home"
              ? homeRosterList
              : editSide === "away"
                ? awayRosterList
                : [];
          const foulerSideEdit = editDraft.foulerSide as TeamSide | undefined;
          const fouledSideEdit = foulerSideEdit
            ? opponentOf(foulerSideEdit)
            : undefined;
          const foulerRoster =
            foulerSideEdit === "home"
              ? homeRosterList
              : foulerSideEdit === "away"
                ? awayRosterList
                : [];
          const fouledRoster =
            fouledSideEdit === "home"
              ? homeRosterList
              : fouledSideEdit === "away"
                ? awayRosterList
                : [];

          const sel =
            "rounded border border-gray-300 px-2 py-1.5 text-sm w-full";
          const lbl = "flex flex-col gap-1 text-xs font-semibold text-gray-700";

          const canEdit = [
            "shot",
            "assist",
            "foul",
            "free throw",
            "turnover",
            "steal",
            "rebound",
            "block",
          ].includes(action);

          return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-3">
              <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 capitalize">
                      {action} — Edit
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {editingLog.period} · {editingLog.clock} ·{" "}
                      {editingLog.team}
                    </p>
                  </div>
                  {!hasSyncId && (
                    <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Pending sync
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {action === "shot" && editSide && (
                    <>
                      <label className={lbl}>
                        Shooter
                        <select
                          className={sel}
                          value={(editDraft.shooterJersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              shooterJersey: +e.target.value,
                            }))
                          }
                        >
                          {editRosterNums.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(editSide, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={lbl}>
                        Result
                        <select
                          className={sel}
                          value={(editDraft.result as string) ?? "made"}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              result: e.target.value,
                            }))
                          }
                        >
                          <option value="made">Made</option>
                          <option value="missed">Missed</option>
                        </select>
                      </label>
                      <label className={lbl}>
                        Shot value
                        <select
                          className={sel}
                          value={(editDraft.shotValue as number) ?? 2}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              shotValue: +e.target.value,
                            }))
                          }
                        >
                          <option value={1}>1 pt (Free throw)</option>
                          <option value={2}>2 pt</option>
                          <option value={3}>3 pt</option>
                        </select>
                      </label>
                    </>
                  )}

                  {action === "assist" && editSide && (
                    <>
                      <label className={lbl}>
                        Assister
                        <select
                          className={sel}
                          value={(editDraft.assistJersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              assistJersey: +e.target.value,
                            }))
                          }
                        >
                          {editRosterNums.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(editSide, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={lbl}>
                        Assisted player
                        <select
                          className={sel}
                          value={(editDraft.assistedJersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              assistedJersey: +e.target.value,
                            }))
                          }
                        >
                          {editRosterNums.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(editSide, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  {action === "foul" && foulerSideEdit && fouledSideEdit && (
                    <>
                      <p className="text-xs text-gray-500 -mb-1">
                        Foul type:{" "}
                        <span className="font-semibold text-gray-700">
                          {foulTypeLabel(editDraft.foulType as FoulTypeId)}
                        </span>
                      </p>
                      <label className={lbl}>
                        Fouler
                        <select
                          className={sel}
                          value={(editDraft.foulerJersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              foulerJersey: +e.target.value,
                            }))
                          }
                        >
                          {foulerRoster.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(foulerSideEdit, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {editDraft.foulType !== "technical" && (
                        <label className={lbl}>
                          Fouled player
                          <select
                            className={sel}
                            value={(editDraft.fouledJersey as number) ?? ""}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                fouledJersey: +e.target.value,
                              }))
                            }
                          >
                            {fouledRoster.map((j) => (
                              <option key={j} value={j}>
                                {getPlayerLabel(fouledSideEdit, j)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  )}

                  {action === "free throw" &&
                    (() => {
                      const ftSide = editDraft.shooterSide as
                        | TeamSide
                        | undefined;
                      if (!ftSide) return null;
                      const ftRoster =
                        ftSide === "home" ? homeRosterList : awayRosterList;
                      return (
                        <>
                          <p className="text-xs text-gray-500 -mb-1">
                            Free throw {editDraft.attempt as number} of{" "}
                            {editDraft.totalAttempts as number}
                          </p>
                          <label className={lbl}>
                            Shooter
                            <select
                              className={sel}
                              value={(editDraft.shooterJersey as number) ?? ""}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  shooterJersey: +e.target.value,
                                }))
                              }
                            >
                              {ftRoster.map((j) => (
                                <option key={j} value={j}>
                                  {getPlayerLabel(ftSide, j)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={lbl}>
                            Result
                            <select
                              className={sel}
                              value={(editDraft.result as string) ?? "made"}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  result: e.target.value,
                                }))
                              }
                            >
                              <option value="made">Made</option>
                              <option value="missed">Missed</option>
                            </select>
                          </label>
                        </>
                      );
                    })()}

                  {action === "turnover" && editSide && (
                    <>
                      <label className={lbl}>
                        Player
                        <select
                          className={sel}
                          value={(editDraft.jersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              jersey: +e.target.value,
                            }))
                          }
                        >
                          {editRosterNums.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(editSide, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="text-xs text-gray-500">
                        Type:{" "}
                        <span className="font-semibold text-gray-700">
                          {turnoverTypeLabel(
                            editDraft.turnoverType as TurnoverTypeId,
                          )}
                        </span>
                      </p>
                    </>
                  )}

                  {(action === "steal" || action === "block") && editSide && (
                    <label className={lbl}>
                      Player
                      <select
                        className={sel}
                        value={(editDraft.jersey as number) ?? ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            jersey: +e.target.value,
                          }))
                        }
                      >
                        {editRosterNums.map((j) => (
                          <option key={j} value={j}>
                            {getPlayerLabel(editSide, j)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {action === "rebound" && editSide && (
                    <>
                      <label className={lbl}>
                        Player
                        <select
                          className={sel}
                          value={(editDraft.jersey as number) ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              jersey: +e.target.value,
                            }))
                          }
                        >
                          {editRosterNums.map((j) => (
                            <option key={j} value={j}>
                              {getPlayerLabel(editSide, j)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={lbl}>
                        Type
                        <select
                          className={sel}
                          value={
                            (editDraft.reboundType as string) ?? "defensive"
                          }
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              reboundType: e.target.value,
                            }))
                          }
                        >
                          <option value="offensive">Offensive</option>
                          <option value="defensive">Defensive</option>
                        </select>
                      </label>
                    </>
                  )}

                  {!canEdit && (
                    <p className="text-sm text-gray-600 rounded bg-gray-50 p-3">
                      This event type cannot be edited directly. Use{" "}
                      <strong>Reverse</strong> to undo it.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isReconcilingLog}
                    onClick={handleCloseLogEditor}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isReconcilingLog || !hasSyncId}
                    onClick={handleReverseEditingLog}
                    className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
                  >
                    {isReconcilingLog ? "Applying…" : "Reverse"}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={isReconcilingLog || !hasSyncId}
                      onClick={handleSaveEditingLog}
                      className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
                    >
                      {isReconcilingLog ? "Saving…" : "Save"}
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
