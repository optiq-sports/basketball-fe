export type TeamSide = 'home' | 'away';

export type StatDashClock = string;

export interface TeamRef {
  id: string;
  name: string;
  shortName?: string | null;
}

export interface SessionStateSnapshot {
  sessionId: string;
  matchId: string;
  status: string;
  quarter: number;
  clockSecondsRemaining: number;
  version: number;
  score: {
    home: number;
    away: number;
  };
  orientation: {
    homeOnLeft: boolean;
    homeAttacksLeft: boolean;
  };
  jumpBallWinnerTeamId?: string | null;
  possessionTeamId?: string | null;
  activeLineups?: {
    homeLineup: unknown;
    awayLineup: unknown;
  };
  recentEvents: Array<{
    id: string;
    sequence: number;
    eventType: string;
    payload: unknown;
    createdAt: string | Date;
  }>;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
}

export interface ResolveSessionResponse {
  matchId: string;
  matchStatus: string;
  sessionId: string | null;
  sessionStatus: string | null;
}

export interface ResolveSessionRequest {
  matchKey: string;
}

export interface SessionBootstrapRequest {
  matchId?: string;
  sessionId?: string;
}

/** Response shape shared by the session lifecycle endpoints: start, pause, complete, cancel. */
export interface SessionLifecycleResponse {
  id: string;
  matchId: string;
  status: string;
  quarter: number;
  clockSecondsRemaining: number;
  homeScore: number;
  awayScore: number;
  version: number;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
}

export interface CommandEnvelope<TPayload = unknown> {
  sessionId: string;
  commandType: string;
  payload: TPayload;
  expectedVersion: number;
  idempotencyKey: string;
  /** Links a generated command (e.g. a free throw) to the event that caused it (e.g. its
   * foul), so reversing the parent cascades to reverse this one too. See Backend Gap #15. */
  parentEventId?: string;
}

export interface CommandAcceptedResponse {
  sessionId: string;
  version: number;
  score: {
    home: number;
    away: number;
  };
  emittedEvents: Array<{
    id: string;
    sequence: number;
    eventType: string;
    createdAt: string | Date;
  }>;
}

export interface VersionConflictErrorResponse {
  code: 'VERSION_CONFLICT';
  message: string;
  expectedVersion: number;
  actualVersion: number;
  state?: SessionStateSnapshot;
}

export interface ProjectionRequestParams {
  fromVersion?: number;
}

/** One player's line from GET /statdash/projections/player/:playerId/game/:sessionId. */
export interface PlayerGameProjection {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
}

export interface BoxScoreProjection {
  players: Record<
    string,
    {
      playerId: string;
      points: number;
      rebounds: number;
      assists: number;
      blocks: number;
      steals: number;
      fouls: number;
      turnovers: number;
    }
  >;
  totals: {
    points: number;
    rebounds: number;
    assists: number;
    blocks: number;
    steals: number;
    fouls: number;
    turnovers: number;
  };
  totalEvents: number;
}

export interface ShotPoint {
  id: string;
  teamSide: TeamSide;
  playerId: string;
  made: boolean;
  points: 2 | 3;
  x: number;
  y: number;
  period: number;
}

export interface ShotChartProjection {
  eventId: string;
  teamId: string | null;
  shooterPlayerId: string | null;
  result: string | null;
  shotValue: number | null;
  x: number | null;
  y: number | null;
  sequence: number;
  period?: number;
}

export interface SessionSummaryProjection {
  sessionId: string;
  /** Not sent yet (Gap 54). Keyed by team id. */
  advanced?: Record<string, AdvancedTeamStats>;
  version: number;
  score: {
    home: number;
    away: number;
  };
  totals: {
    points: number;
    rebounds: number;
    assists: number;
    blocks: number;
    steals: number;
    fouls: number;
    turnovers: number;
  };
  totalEvents: number;
  generatedAt: string;
}

export interface RealtimeSessionMessage {
  sessionId: string;
  source: 'command' | 'correction' | 'reversal';
  state: {
    version: number;
    score: {
      home: number;
      away: number;
    };
  };
  deltaEvents: Array<{
    id?: string;
    sequence?: number;
    eventType?: string;
    createdAt?: string | Date;
  }>;
}

/**
 * One recorded play, in order, with the score after it. Requested from the backend as
 * `GET /statdash/projections/match/:sessionId/timeline` (Gap 53); the shape below is the contract the
 * frontend was built against.
 */
export interface TimelineEvent {
  sequence: number;
  /** e.g. `shot`, `free_throw`, `rebound`, `foul`, `turnover`, `substitution`, `period_end`, `game_end`. */
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  /** 1–4, then 5 and up for overtime. */
  period: number | null;
  clockSecondsRemaining: number | null;
  /** The running score after this play. */
  homeScore: number;
  awayScore: number;
  /** What happened, without the player's name: "2PtsFG jump shot made", "offensive rebound". */
  description: string;
}

/**
 * Team stats the scorer's feed can't give today (Gap 54), requested as an optional `advanced` block on the
 * summary projection. Any field may be absent; the page shows only what comes.
 */
export interface AdvancedTeamStats {
  pointsInPaint?: number;
  fastBreakPoints?: number;
  pointsOffTurnovers?: number;
  secondChancePoints?: number;
  benchPoints?: number;
}
