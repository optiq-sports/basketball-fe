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

export interface CommandEnvelope<TPayload = unknown> {
  sessionId: string;
  commandType: string;
  payload: TPayload;
  expectedVersion: number;
  idempotencyKey: string;
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
