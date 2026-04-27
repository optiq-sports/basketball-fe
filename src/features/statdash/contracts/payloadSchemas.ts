export interface ShotCommandPayload {
  teamId: string;
  shooterPlayerId: string;
  shotValue: 1 | 2 | 3;
  result: 'made' | 'missed';
  x?: number;
  y?: number;
}

export interface ReboundCommandPayload {
  teamId: string;
  playerId: string;
  reboundType: 'offensive' | 'defensive';
}

export interface FoulCommandPayload {
  teamId: string;
  foulerPlayerId: string;
  foulType: string;
  fouledPlayerId?: string;
  freeThrowsAwarded?: number;
}

export interface FreeThrowCommandPayload {
  teamId: string;
  playerId: string;
  attemptNumber: number;
  totalAttempts: number;
  result: 'made' | 'missed';
}

export interface TurnoverCommandPayload {
  teamId: string;
  playerId: string;
  turnoverType: string;
}

export interface StealCommandPayload {
  teamId: string;
  playerId: string;
  againstPlayerId: string;
}

export interface BlockCommandPayload {
  teamId: string;
  blockerPlayerId: string;
  againstPlayerId: string;
}

export interface SubstitutionCommandPayload {
  teamId: string;
  playerOutId: string;
  playerInId: string;
}

export interface TimeoutCommandPayload {
  timeoutType: 'full' | 'short' | 'official';
}

export interface JumpBallCommandPayload {
  winningTeamId: string;
}

export interface DeadBallCommandPayload {
  reason: 'out_of_bounds' | 'shot_clock_violation' | 'held_ball' | 'lane_violation';
  teamId?: string;
}

export interface AssistCommandPayload {
  teamId: string;
  playerId: string;
  assistedPlayerId: string;
}

export interface ClockCommandPayload {
  quarter: number;
  clockSecondsRemaining: number;
  isRunning: boolean;
}

export type StatDashCommandPayload =
  | ShotCommandPayload
  | AssistCommandPayload
  | ReboundCommandPayload
  | BlockCommandPayload
  | FoulCommandPayload
  | FreeThrowCommandPayload
  | TurnoverCommandPayload
  | StealCommandPayload
  | DeadBallCommandPayload
  | SubstitutionCommandPayload
  | JumpBallCommandPayload
  | TimeoutCommandPayload
  | ClockCommandPayload;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isShotCommandPayload(value: unknown): value is ShotCommandPayload {
  if (!isObject(value)) return false;
  return (
    typeof value.teamId === 'string' &&
    typeof value.shooterPlayerId === 'string' &&
    (value.shotValue === 1 || value.shotValue === 2 || value.shotValue === 3) &&
    (value.result === 'made' || value.result === 'missed')
  );
}

export function isFoulCommandPayload(value: unknown): value is FoulCommandPayload {
  if (!isObject(value)) return false;
  return (
    typeof value.teamId === 'string' &&
    typeof value.foulerPlayerId === 'string' &&
    typeof value.foulType === 'string'
  );
}

export function isTurnoverCommandPayload(value: unknown): value is TurnoverCommandPayload {
  if (!isObject(value)) return false;
  return (
    typeof value.teamId === 'string' &&
    typeof value.playerId === 'string' &&
    typeof value.turnoverType === 'string'
  );
}
