import type { GameLogEntry, TeamSide } from './types';
import { formatClock } from './components/GameTimer';
import { formatPeriodLabel } from './periodLabel';

export interface ReplayPlayerRef {
  side: TeamSide;
  jersey: number;
}

export interface ReplayableEvent {
  id: string;
  sequence: number;
  eventType: string;
  payload: unknown;
  createdAt: string | Date;
}

export interface GameLogReplayContext {
  homeTeamId?: string;
  awayTeamId?: string;
  homeName: string;
  awayName: string;
  resolvePlayer: (playerId: unknown) => ReplayPlayerRef | null;
  getPlayerLabel: (side: TeamSide | null, jersey: number) => string;
}

function teamNameForId(ctx: GameLogReplayContext, teamId: unknown): string {
  if (typeof teamId !== 'string') return '—';
  if (teamId === ctx.homeTeamId) return ctx.homeName;
  if (teamId === ctx.awayTeamId) return ctx.awayName;
  return '—';
}

function playerField(
  ctx: GameLogReplayContext,
  playerId: unknown,
): { text: string; ref: ReplayPlayerRef | null } {
  const ref = ctx.resolvePlayer(playerId);
  if (!ref) return { text: '—', ref: null };
  return { text: ctx.getPlayerLabel(ref.side, ref.jersey), ref: ref };
}

/** "jump_shot" -> "Jump shot", "unsportsmanlike" -> "Unsportsmanlike" */
function prettyType(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  const words = raw.split('_');
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function periodClockFromPayload(payload: Record<string, unknown>): {
  period: string;
  clock: string;
} {
  const period = typeof payload.period === 'number' ? formatPeriodLabel(payload.period) : '—';
  const clock =
    typeof payload.clockSecondsRemaining === 'number'
      ? formatClock(payload.clockSecondsRemaining)
      : '—';
  return { period, clock };
}

/**
 * Reconstructs game log rows from the backend's raw GameEvent history
 * (`snapshot.recentEvents`, oldest first) so a reconnecting statistician sees
 * the last plays instead of a blank log — the backend, not sessionStorage, is
 * the source of truth for what already happened in the game.
 *
 * Best-effort: only the last 25 events are available (see bootstrap's
 * `take: 25`), and `period`/`clockSecondsRemaining` show as "—" until the
 * backend whitelists them on every command DTO (docs/BACKEND_GAPS.md Gap #11).
 * Returns entries newest-first, matching how the live log is built.
 */
export function buildGameLogFromEvents(
  events: ReplayableEvent[],
  ctx: GameLogReplayContext,
): GameLogEntry[] {
  const entries: GameLogEntry[] = [];

  for (const event of events) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const { period, clock } = periodClockFromPayload(payload);

    switch (event.eventType) {
      case 'shot': {
        const shot = (payload.shot ?? {}) as Record<string, unknown>;
        const shooter = playerField(ctx, payload.shooterPlayerId);
        const made = shot.result === 'made';
        const value = typeof shot.value === 'number' ? shot.value : null;
        const typeLabel = prettyType(shot.type) || 'Shot';
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: shooter.text,
          action: 'shot',
          result: `${typeLabel} ${made ? 'made' : 'missed'}${value ? ` (${value}pt)` : ''}`,
        });
        if (typeof payload.assistPlayerId === 'string') {
          const assister = playerField(ctx, payload.assistPlayerId);
          entries.push({
            id: `replay_${event.id}_assist`,
            period,
            clock,
            team: teamNameForId(ctx, payload.teamId),
            player: assister.text,
            action: 'assist',
            result: `To ${shooter.text}`,
          });
        }
        if (typeof payload.blockPlayerId === 'string') {
          const blocker = playerField(ctx, payload.blockPlayerId);
          entries.push({
            id: `replay_${event.id}_block`,
            period,
            clock,
            team: blocker.ref ? (blocker.ref.side === 'home' ? ctx.homeName : ctx.awayName) : '—',
            player: blocker.text,
            action: 'block',
            result: `Blocked ${shooter.text}`,
          });
        }
        break;
      }
      case 'free_throw': {
        const shooter = playerField(ctx, payload.shooterPlayerId);
        const attempt = payload.attempt ?? payload.attemptNumber;
        const total = payload.totalAttempts;
        const countLabel =
          typeof attempt === 'number' && typeof total === 'number' ? ` (${attempt}/${total})` : '';
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: shooter.text,
          action: 'free throw',
          result: `${payload.result === 'made' ? 'Made' : 'Missed'}${countLabel}`,
        });
        break;
      }
      case 'rebound': {
        const rebound = (payload.rebound ?? {}) as Record<string, unknown>;
        const player = playerField(ctx, payload.reboundPlayerId);
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: player.text,
          action: 'rebound',
          result: rebound.type === 'offensive' ? 'Off Rebound' : 'Def Rebound',
        });
        break;
      }
      case 'foul': {
        const isTechnical = payload.foulType === 'technical';
        const fouler = playerField(ctx, payload.foulerPlayerId);
        const fouled = playerField(ctx, payload.fouledPlayerId);
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: fouler.text,
          action: 'foul',
          result: isTechnical
            ? 'Technical foul'
            : `${prettyType(payload.foulType)} foul${fouled.ref ? ` on ${fouled.text}` : ''}`,
        });
        break;
      }
      case 'turnover': {
        const turnover = (payload.turnover ?? {}) as Record<string, unknown>;
        const player = playerField(ctx, payload.turnoverPlayerId);
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: player.text,
          action: 'turnover',
          result: prettyType(turnover.type) || 'Turnover',
        });
        if (typeof payload.stealPlayerId === 'string') {
          const stealer = playerField(ctx, payload.stealPlayerId);
          entries.push({
            id: `replay_${event.id}_steal`,
            period,
            clock,
            team: stealer.ref ? (stealer.ref.side === 'home' ? ctx.homeName : ctx.awayName) : '—',
            player: stealer.text,
            action: 'steal',
            result: `Off ${player.text} turnover`,
          });
        }
        break;
      }
      case 'dead_ball': {
        const deadBall = (payload.deadBall ?? {}) as Record<string, unknown>;
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: '—',
          action: 'dead ball',
          result: prettyType(deadBall.reason) || 'Dead ball',
        });
        break;
      }
      case 'substitution': {
        const playerOut = playerField(ctx, payload.playerOutId);
        const playerIn = playerField(ctx, payload.playerInId);
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: '—',
          action: 'substitution',
          result: `${playerIn.text} in / ${playerOut.text} out`,
        });
        break;
      }
      case 'timeout': {
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.teamId),
          player: '—',
          action: 'timeout',
          result: typeof payload.timeoutType === 'string' ? payload.timeoutType : 'full',
        });
        break;
      }
      case 'jump_ball': {
        entries.push({
          id: `replay_${event.id}`,
          backendEventId: event.id,
          period,
          clock,
          team: teamNameForId(ctx, payload.winningTeamId),
          player: '—',
          action: 'jump ball',
          result: 'possession',
        });
        break;
      }
      default:
        // 'clock', 'correction', 'reversal' and anything unrecognized aren't shown as plays.
        break;
    }
  }

  return entries.reverse();
}
