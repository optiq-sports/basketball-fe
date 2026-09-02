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
} from "./substitutionLineupUtils";
import { readGameSetupOrientation } from "../gameSetupOrientation";
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
  // Backend GameSession.status (PENDING/IN_PROGRESS/PAUSED/COMPLETED/CANCELLED) — distinct from
  // `isRunning`, which only tracks the local clock. Drives the Pause/Resume/Finish/Cancel menu.
  const [sessionStatus, setSessionStatus] = useState<string>("PENDING");
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
  const pendingCountRef = useRef(0);
  const queueRef = useRef<QueuedEvent[]>([]);
  const markersRestoredRef = useRef(false);
  const gameLogRestoredRef = useRef(false);
  const lineupRestoredRef = useRef(false);
  const recentEventsRef = useRef<SessionStateSnapshot["recentEvents"]>([]);
  const activeLineupsRef =
    useRef<SessionStateSnapshot["activeLineups"]>(undefined);

  const applyAuthoritativeState = useCallback((state: SessionStateSnapshot) => {
    setHomeScore(state.score.home);
    setAwayScore(state.score.away);
    setQuarter(state.quarter);
    setTimerSeconds(state.clockSecondsRemaining);
    setIsRunning(state.status === "IN_PROGRESS");
    setSessionStatus(state.status);
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

  const {
    enqueue,
    queue,
    pendingCount,
    failedCount,
    isOnline,
    retryFailed,
    discardEvent,
  } = useEventQueue({
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
      options?: { stampClock?: boolean },
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
  // — and an untied score just stops the clock (game over).
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
    setTimerSeconds(0);
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
        writeStoredExpectedVersion(snapshot.version);
        latestVersionRef.current = snapshot.version;
        recentEventsRef.current = snapshot.recentEvents ?? [];
        activeLineupsRef.current = snapshot.activeLineups;
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
      if (sessionStatus === "PAUSED") {
        await sessionsApi.startSession(context.sessionId);
      } else {
        await sessionsApi.pauseSession(context.sessionId);
      }
      const latest = await sessionsApi.getSessionState(context.sessionId);
      writeStoredExpectedVersion(latest.version);
      latestVersionRef.current = latest.version;
      applyAuthoritativeState(latest);
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
      void commitEventCommand("clock", {
        period: quarter,
        clockSecondsRemaining: next,
        isRunning,
      });
    },
    [commitEventCommand, timerSeconds, quarter, isRunning],
  );

  const onAdjustSeconds = useCallback(
    (delta: number) => {
      const next = Math.max(
        0,
        Math.min(MAX_TIMER_SECONDS, timerSeconds + delta),
      );
      setTimerSeconds(next);
      void commitEventCommand("clock", {
        period: quarter,
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
            const committed = await commitEventCommand("substitution", {
              teamId: getTeamIdForSide(side),
              playerOutId: getPlayerId(side, diff.out[idx]),
              playerInId: getPlayerId(side, diff.in[idx]),
              homeLineup: homeLineupIds,
              awayLineup: awayLineupIds,
            });
            if (!committed) {
              setSyncNotice(
                "Couldn't save this substitution — your session may have expired. Try again.",
              );
              return false;
            }
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
      setOvertimeModalOpen(true);
    } else {
      setQuarterBreakModalOpen(true);
    }
  }, [quarter]);

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
      let target = entry;
      if (entry.action === "assist" && entry.localId) {
        const parentShot = gameLog.find(
          (row) => row.action === "shot" && row.localId === entry.localId,
        );
        if (parentShot) target = parentShot;
      }
      setEditingLog(target);
      const draft: Record<string, unknown> = target.meta
        ? { ...target.meta }
        : {};
      if (target.action === "shot" && target.localId) {
        const companionAssist = gameLog.find(
          (row) => row.action === "assist" && row.localId === target.localId,
        );
        draft.assistJersey = companionAssist?.meta?.assistJersey ?? "none";
      }
      setEditDraft(draft);
    },
    [gameLog],
  );

  const handleCloseLogEditor = useCallback(() => {
    setEditingLog(null);
    setEditDraft({});
  }, []);

  const handleSaveEditingLog = useCallback(() => {
    if (editingLog === null) return;
    // Narrow once here — the async IIFE below closes over `editingLog`, and TS
    // can't carry the `!editingLog.backendEventId` guard's narrowing across
    // that closure boundary, so it re-widens back to `string | undefined`.
    const backendEventId = editingLog.backendEventId;
    if (!backendEventId) {
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
          const result = (editDraft.result as string) ?? "made";
          const hasPosition = editDraft.x != null && editDraft.y != null;
          // Point value is derived from where the shot was taken on the court,
          // never a free-floating field — changing the shooter or make/miss
          // must not silently change how many points the shot is worth. If we
          // don't have a recorded position (older entry), keep whatever value
          // was already there instead of guessing.
          const shotValue = hasPosition
            ? isCourtClickThreePointer(
                editDraft.x as number,
                editDraft.y as number,
                side,
                homeAttacksLeft,
              )
              ? 3
              : 2
            : ((editDraft.shotValue as number) ?? 2);
          correctedPayload = {
            teamId: getTeamIdForSide(side),
            shooterPlayerId: getPlayerId(
              side,
              editDraft.shooterJersey as number,
            ),
            shotValue,
            result,
            ...(hasPosition ? { x: editDraft.x, y: editDraft.y } : {}),
            // Assist lives on the same backend event as the shot (see
            // handleOpenLogEditor) — submit it here instead of as a separate
            // correction with a payload shape the backend doesn't expect.
            ...(result === "made" &&
            editDraft.assistJersey &&
            editDraft.assistJersey !== "none"
              ? {
                  assistPlayerId: getPlayerId(
                    side,
                    editDraft.assistJersey as number,
                  ),
                }
              : {}),
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

        const response = await commandsApi.correctEvent(backendEventId, {
          reason: "Corrected from StatDash log editor",
          correctedPayload,
        });
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
    const backendEventId = editingLog.backendEventId;
    if (!backendEventId) {
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
          backendEventId,
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

  // A queued command that the backend permanently rejected (status 'failed',
  // e.g. a validation error) never gets a backendEventId and so can never be
  // corrected or reversed via the server — there's nothing there to reverse.
  // This removes it locally only: no backend call, since none is possible.
  const handleDiscardEditingLog = useCallback(() => {
    if (editingLog === null) return;
    if (editingLog.localId) {
      discardEvent(editingLog.localId);
      setGameLog((prev) => prev.filter((e) => e.localId !== editingLog.localId));
    } else {
      setGameLog((prev) => prev.filter((e) => e.id !== editingLog.id));
    }
    setEditingLog(null);
    setEditDraft({});
    setSyncNotice(
      "Discarded. The server rejected this action and never applied it, so there was nothing to reverse.",
    );
  }, [discardEvent, editingLog]);

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
                  showQuarterFinish={quarterEndAwaitingFinish}
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
                onClick={() => setFinishConfirmOpen(false)}
                className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
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
          const action = editingLog.action;
          const hasSyncId = Boolean(editingLog.backendEventId);
          // A 'failed' queue entry was rejected by the backend and will never get
          // a backendEventId — it was never applied server-side, so it can only be
          // discarded locally, never "reversed" (there's nothing there to reverse).
          const queuedEntry = editingLog.localId
            ? queue.find((q) => q.localId === editingLog.localId)
            : undefined;
          const isFailedLocally = !hasSyncId && queuedEntry?.status === "failed";
          // Determine team side from meta for player roster lookups
          const editSide = (editDraft.side ?? editDraft.foulerSide) as
            | TeamSide
            | undefined;

          // Who could actually have made this play: whoever was on the court for
          // that team at the moment it happened (stamped by appendLog), not the
          // full roster — you can't shoot, rebound, or steal from the bench.
          // Falls back to the full roster for older entries logged before this
          // snapshot existed, and always keeps the play's original player
          // selectable even if a lineup mismatch would otherwise exclude them.
          const onCourtRosterFor = (
            side: TeamSide | undefined,
            currentValue: unknown,
          ): number[] => {
            if (!side) return [];
            const snapshot =
              side === "home"
                ? (editingLog.meta?.onCourtHome as number[] | undefined)
                : (editingLog.meta?.onCourtAway as number[] | undefined);
            const base =
              snapshot && snapshot.length > 0
                ? snapshot
                : side === "home"
                  ? homeRosterList
                  : awayRosterList;
            const withCurrent =
              typeof currentValue === "number" && !base.includes(currentValue)
                ? [...base, currentValue]
                : base;
            return [...withCurrent].sort((a, b) => a - b);
          };

          const editRosterNums = onCourtRosterFor(
            editSide,
            editDraft.shooterJersey ??
              editDraft.jersey ??
              editDraft.assistJersey,
          );
          const foulerSideEdit = editDraft.foulerSide as TeamSide | undefined;
          const fouledSideEdit = foulerSideEdit
            ? opponentOf(foulerSideEdit)
            : undefined;
          const foulerRoster = onCourtRosterFor(
            foulerSideEdit,
            editDraft.foulerJersey,
          );
          const fouledRoster = onCourtRosterFor(
            fouledSideEdit,
            editDraft.fouledJersey,
          );
          const assistCandidates = onCourtRosterFor(
            editSide,
            editDraft.assistJersey,
          ).filter((j) => j !== editDraft.shooterJersey);

          // Point value follows the shot's recorded court position, same rule
          // the live recording flow uses — it's derived, not a separate field
          // the statistician can set independently of where the shot was taken.
          const hasShotPosition = editDraft.x != null && editDraft.y != null;
          const derivedShotValue =
            action === "shot" && editSide
              ? hasShotPosition
                ? isCourtClickThreePointer(
                    editDraft.x as number,
                    editDraft.y as number,
                    editSide,
                    homeAttacksLeft,
                  )
                  ? 3
                  : 2
                : ((editDraft.shotValue as number) ?? 2)
              : 2;

          const sel =
            "border border-gray-300 px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-sky-400/50";
          const lbl = "flex flex-col gap-1 text-xs font-semibold text-gray-700";

          // "assist" isn't independently editable — handleOpenLogEditor always
          // redirects an assist row to its parent shot, which carries the
          // assist field too. It only reaches here if that redirect couldn't
          // find a parent (data anomaly), where "cannot be edited" is correct.
          const canEdit = [
            "shot",
            "foul",
            "free throw",
            "turnover",
            "steal",
            "rebound",
            "block",
          ].includes(action);

          return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-3 backdrop-blur-sm">
              <div className="w-full max-w-lg border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
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
                    <span
                      className={`shrink-0 px-2 py-0.5 text-xs font-semibold ${
                        isFailedLocally
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isFailedLocally ? "Sync failed" : "Pending sync"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {action === "shot" && editSide && (
                    <>
                      <label className={lbl}>
                        Shooter
                        <span className="text-[10px] font-normal normal-case text-gray-400">
                          Only players on the court for this play
                        </span>
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

                      <div className="flex items-center justify-between border border-gray-200 bg-gray-50 px-3 py-2">
                        <span className="text-xs font-semibold text-gray-700">
                          Shot value
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {derivedShotValue} pt
                        </span>
                      </div>
                      <p className="-mt-2 text-[10px] text-gray-400">
                        {hasShotPosition
                          ? "Set from where the shot was taken on the court — changing the shooter or result won't change this."
                          : "No court position was recorded for this shot, so the original point value is kept as-is."}
                      </p>

                      {editDraft.result === "made" && (
                        <label className={lbl}>
                          Assist
                          <select
                            className={sel}
                            value={(editDraft.assistJersey as
                              | number
                              | "none") ?? "none"}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                assistJersey:
                                  e.target.value === "none"
                                    ? "none"
                                    : +e.target.value,
                              }))
                            }
                          >
                            <option value="none">No assist</option>
                            {assistCandidates.map((j) => (
                              <option key={j} value={j}>
                                {getPlayerLabel(editSide, j)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
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
                      const ftRoster = onCourtRosterFor(
                        ftSide,
                        editDraft.shooterJersey,
                      );
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
                    <p className="text-sm text-gray-600 border border-gray-200 bg-gray-50 p-3">
                      This event type cannot be edited directly. Use{" "}
                      <strong>Reverse</strong> to undo it.
                    </p>
                  )}

                  {!hasSyncId && (
                    <p
                      className={`text-xs p-2 ${isFailedLocally ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {isFailedLocally
                        ? "The server rejected this action, so it was never applied — Save and Reverse aren't available since there's nothing to correct or undo server-side. Discard removes it from your log."
                        : "Still syncing to the server. Save and Reverse unlock once this action is confirmed."}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isReconcilingLog}
                    onClick={handleCloseLogEditor}
                    className="border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isReconcilingLog || (!hasSyncId && !isFailedLocally)}
                    onClick={
                      isFailedLocally
                        ? handleDiscardEditingLog
                        : handleReverseEditingLog
                    }
                    className="bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
                  >
                    {isReconcilingLog
                      ? "Applying…"
                      : isFailedLocally
                        ? "Discard"
                        : "Reverse"}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={isReconcilingLog || !hasSyncId}
                      onClick={handleSaveEditingLog}
                      className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
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
