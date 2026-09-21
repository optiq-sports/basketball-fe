import type { QueuedEvent } from '../../../features/statdash/eventQueue/types';
import type { GameLogEntry, TeamSide } from '../types';

/** Everything a statistician can change after the fact. Assist / steal / block rows are shown in the
 * log but belong to a parent play (a shot, a turnover) and are changed through it. */
export const EDITABLE_ACTIONS = [
  'shot', 'foul', 'free throw', 'turnover', 'rebound', 'substitution', 'timeout', 'jump ball',
] as const;

export function isEditableAction(action: string): boolean {
  return (EDITABLE_ACTIONS as readonly string[]).includes(action);
}

const ACTION_TITLES: Record<string, string> = {
  shot: 'Shot',
  foul: 'Foul',
  'free throw': 'Free throw',
  turnover: 'Turnover',
  rebound: 'Rebound',
  assist: 'Assist',
  steal: 'Steal',
  block: 'Block',
  substitution: 'Substitution',
  timeout: 'Timeout',
  'jump ball': 'Jump ball',
};

export function actionTitle(action: string): string {
  return ACTION_TITLES[action] ?? action.charAt(0).toUpperCase() + action.slice(1);
}

// ---------------------------------------------------------------------------------------------
// Sync status (informational only — nothing is ever blocked on it)
// ---------------------------------------------------------------------------------------------

export type SyncState = 'synced' | 'sending' | 'failed';

const isCommand = (q: QueuedEvent) => (q.kind ?? 'command') === 'command';

export function syncStateFor(entry: GameLogEntry, queue: QueuedEvent[]): SyncState {
  if (entry.backendEventId) return 'synced';
  if (!entry.localId) return 'synced';
  const queued = queue.find((q) => q.localId === entry.localId && isCommand(q));
  if (!queued) return 'synced';
  if (queued.status === 'failed') return 'failed';
  if (queued.status === 'sent') return 'synced';
  return 'sending';
}

// ---------------------------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------------------------

/** Points a log row put on the scoreboard, and for which side. Only made shots and free throws. */
export function pointsOf(row: GameLogEntry): { side: TeamSide; points: number } | null {
  const meta = row.meta ?? {};
  if (row.action === 'shot' && meta.result === 'made') {
    const side = meta.side as TeamSide | undefined;
    if (side !== 'home' && side !== 'away') return null;
    const value = typeof meta.shotValue === 'number' ? meta.shotValue : 2;
    return { side, points: value };
  }
  if (row.action === 'free throw' && meta.result === 'made') {
    const side = meta.shooterSide as TeamSide | undefined;
    if (side !== 'home' && side !== 'away') return null;
    return { side, points: 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------

export interface UndoReversal {
  /** The queued command to undo; its real event id is looked up when this is sent. */
  targetLocalId?: string;
  /** The real event id, when already known (e.g. a play restored after a reload). */
  targetBackendEventId?: string;
}

export interface SubstitutionSwap {
  side: TeamSide;
  outJersey: number;
  inJersey: number;
}

export interface UndoPlan {
  /** Log rows to remove (the play itself, its assist row, and any plays that belong to it). */
  removeRowIds: string[];
  /** Commands the server never applied: just drop them from the queue, no server call. */
  cancelLocalIds: string[];
  /** Plays the server has (or is about to have) that need reversing there. */
  reversals: UndoReversal[];
  /** Points to take off the scoreboard (negative numbers). */
  scoreDelta: { home: number; away: number };
  /** A substitution is undone by swapping the players back with a lineup command, not by reversing
   * the event: reversing doesn't restore who is on the court. `cancelOnly` = the server rejected the
   * sub, so it never took effect there and nothing needs sending. */
  substitution?: { swap: SubstitutionSwap; cancelOnly: boolean };
}

/**
 * Works out everything needed to undo a play, without touching anything. Undo is local-first: the
 * caller applies the local effects immediately and sends whatever the server needs in the background,
 * so a statistician never waits on a sync to undo a mistake.
 */
export function planUndo(entry: GameLogEntry, gameLog: GameLogEntry[], queue: QueuedEvent[]): UndoPlan {
  const root = entry.localId;

  // Plays that belong to this one (a foul's free throws), by log row and by queue link.
  const childIds = new Set<string>();
  if (root) {
    for (const row of gameLog) {
      const parent = row.meta?.parentLocalId;
      if (parent === root && row.localId) childIds.add(row.localId);
    }
    for (const q of queue) {
      if (q.parentLocalId === root && isCommand(q)) childIds.add(q.localId);
    }
  }
  const commandIds = root ? [root, ...childIds] : [];

  const removeRowIds = new Set<string>([entry.id]);
  for (const row of gameLog) {
    if (row.localId && commandIds.includes(row.localId)) removeRowIds.add(row.id);
  }

  const cancelLocalIds: string[] = [];
  const reversals: UndoReversal[] = [];

  const backendIdFor = (localId: string): string | undefined =>
    gameLog.find((r) => r.localId === localId && r.backendEventId)?.backendEventId ??
    queue.find((q) => q.localId === localId && isCommand(q))?.backendEventIds?.[0];

  const isSub = entry.action === 'substitution';

  if (commandIds.length === 0) {
    // A play restored from history after a reload: no queue entry, only its real event id.
    if (!isSub && entry.backendEventId) reversals.push({ targetBackendEventId: entry.backendEventId });
  } else {
    let rootReversedOnServer = false;
    for (const id of commandIds) {
      const queued = queue.find((q) => q.localId === id && isCommand(q));
      const isRoot = id === root;
      // A substitution carries the whole lineup, so a queued one can't be quietly dropped without
      // leaving later ones (which assume it happened) inconsistent — it's undone by sending the
      // corrected lineup instead. Only one the server rejected is dropped.
      const unsent =
        queued &&
        (isSub ? queued.status === 'failed' : queued.status === 'pending' || queued.status === 'failed');
      if (unsent) {
        cancelLocalIds.push(id);
        continue;
      }
      if (isSub) continue; // handled via `substitution` below
      const backendId = backendIdFor(id);
      if (!queued && !backendId) continue; // nothing on the server to undo
      // The server undoes a foul's linked free throws together with the foul.
      if (!isRoot && rootReversedOnServer && queued?.parentLocalId === root) continue;
      reversals.push({ ...(queued ? { targetLocalId: id } : {}), ...(backendId ? { targetBackendEventId: backendId } : {}) });
      if (isRoot) rootReversedOnServer = true;
    }
  }

  const scoreDelta = { home: 0, away: 0 };
  for (const row of gameLog) {
    if (!removeRowIds.has(row.id)) continue;
    const pts = pointsOf(row);
    if (pts) scoreDelta[pts.side] -= pts.points;
  }

  let substitution: UndoPlan['substitution'];
  if (isSub) {
    const meta = entry.meta ?? {};
    const side = meta.side as TeamSide | undefined;
    const outJersey = meta.outJersey;
    const inJersey = meta.inJersey;
    if ((side === 'home' || side === 'away') && typeof outJersey === 'number' && typeof inJersey === 'number') {
      // Undoing "out #16, in #12" puts #16 back and #12 out.
      substitution = {
        swap: { side, outJersey: inJersey, inJersey: outJersey },
        cancelOnly: cancelLocalIds.length > 0,
      };
    }
  }

  return { removeRowIds: [...removeRowIds], cancelLocalIds, reversals, scoreDelta, substitution };
}

/** A substitution can be undone only if the player who came on is still on the court and the player
 * who went off is still on the bench; otherwise later changes have to be undone first. */
export function canSwapBack(swap: SubstitutionSwap, onCourt: number[]): { ok: true } | { ok: false; reason: string } {
  // `swap` is expressed as the *undo*: outJersey leaves the court, inJersey comes back on.
  if (!onCourt.includes(swap.outJersey)) {
    return { ok: false, reason: `#${swap.outJersey} isn't on the court any more — a later substitution changed that. Undo that one first.` };
  }
  if (onCourt.includes(swap.inJersey)) {
    return { ok: false, reason: `#${swap.inJersey} is already back on the court.` };
  }
  return { ok: true };
}

/** One plain sentence saying what pressing Undo will do. */
export function describeUndo(entry: GameLogEntry, plan: UndoPlan, names: { home: string; away: string }): string {
  const parts: string[] = [];
  if (plan.substitution) {
    const { swap } = plan.substitution;
    parts.push(`Puts #${swap.inJersey} back on the court and #${swap.outJersey} back on the bench`);
  } else {
    parts.push(`Removes this ${actionTitle(entry.action).toLowerCase()} from the game log`);
  }
  const home = -plan.scoreDelta.home;
  const away = -plan.scoreDelta.away;
  if (home > 0) parts.push(`takes ${home} point${home === 1 ? '' : 's'} off ${names.home}`);
  if (away > 0) parts.push(`takes ${away} point${away === 1 ? '' : 's'} off ${names.away}`);
  if (entry.action === 'foul' && plan.removeRowIds.length > 1) parts.push('and removes the free throws that came from it');
  return `${parts.join(', ')}.`;
}

// ---------------------------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------------------------

export interface CorrectionContext {
  getPlayerId: (side: TeamSide, jersey: number) => string;
  getTeamIdForSide: (side: TeamSide) => string;
  /** Whether a shot taken at this court position counts three points for this side. */
  isThreePointer: (x: number, y: number, side: TeamSide) => boolean;
  /** API name for a shot type chosen in the UI ("jump shot" → "jump_shot"). */
  shotTypeToApiType?: (shotType: string) => string;
  foulTypeToApiType?: (foulType: string) => string;
}

export interface CorrectionDraft {
  [key: string]: unknown;
}

/** Points the shot is worth. Derived from where it was taken, never a free-floating field. */
export function shotValueFor(draft: CorrectionDraft, side: TeamSide, ctx: Pick<CorrectionContext, 'isThreePointer'>): number {
  const hasPosition = typeof draft.x === 'number' && typeof draft.y === 'number';
  if (hasPosition) return ctx.isThreePointer(draft.x as number, draft.y as number, side) ? 3 : 2;
  return typeof draft.shotValue === 'number' ? draft.shotValue : 2;
}

/**
 * The fields to change on the stored event, in the shape the backend actually stores.
 *
 * The backend applies a correction by shallow-merging it over the original payload, and its score,
 * box score and shot chart read a shot's result / value / position from the nested `shot` object.
 * So a correction has to replace the whole `shot` object — putting `result` or `shotValue` at the
 * top level is silently ignored by every one of those reads. Likewise a shallow merge can't remove a
 * field, so a removed assist has to be sent as an explicit `null`.
 *
 * `original` is the payload the play was recorded with, when we still have it, so untouched parts of
 * the nested object (shot type, play type) survive the replacement.
 */
export function buildCorrectedPayload(
  action: string,
  draft: CorrectionDraft,
  original: Record<string, unknown> | undefined,
  ctx: CorrectionContext,
): Record<string, unknown> | null {
  switch (action) {
    case 'shot': {
      const side = draft.side as TeamSide;
      const result = draft.result === 'missed' ? 'missed' : 'made';
      const hasPosition = typeof draft.x === 'number' && typeof draft.y === 'number';
      const originalShot = (original?.shot as Record<string, unknown> | undefined) ?? {};
      const type =
        originalShot.type ??
        (typeof draft.shotType === 'string' && ctx.shotTypeToApiType ? ctx.shotTypeToApiType(draft.shotType) : undefined);
      const wantsAssist = result === 'made' && draft.assistJersey !== undefined && draft.assistJersey !== 'none' && typeof draft.assistJersey === 'number';
      return {
        teamId: ctx.getTeamIdForSide(side),
        shooterPlayerId: ctx.getPlayerId(side, draft.shooterJersey as number),
        shot: {
          ...originalShot,
          ...(type !== undefined ? { type } : {}),
          value: shotValueFor(draft, side, ctx),
          result,
          ...(hasPosition ? { x: draft.x, y: draft.y } : {}),
        },
        assistPlayerId: wantsAssist ? ctx.getPlayerId(side, draft.assistJersey as number) : null,
        // A miss can't have been assisted; a block stays as it was.
      };
    }
    case 'foul': {
      const foulerSide = draft.foulerSide as TeamSide;
      const fouledSide: TeamSide = foulerSide === 'home' ? 'away' : 'home';
      return {
        teamId: ctx.getTeamIdForSide(foulerSide),
        ...(typeof draft.foulerJersey === 'number' ? { foulerPlayerId: ctx.getPlayerId(foulerSide, draft.foulerJersey) } : {}),
        ...(typeof draft.fouledJersey === 'number' ? { fouledPlayerId: ctx.getPlayerId(fouledSide, draft.fouledJersey) } : {}),
        ...(typeof draft.foulType === 'string'
          ? { foulType: ctx.foulTypeToApiType ? ctx.foulTypeToApiType(draft.foulType) : draft.foulType }
          : {}),
      };
    }
    case 'free throw': {
      const side = draft.shooterSide as TeamSide;
      return {
        teamId: ctx.getTeamIdForSide(side),
        shooterPlayerId: ctx.getPlayerId(side, draft.shooterJersey as number),
        attempt: draft.attempt,
        totalAttempts: draft.totalAttempts,
        result: draft.result === 'missed' ? 'missed' : 'made',
      };
    }
    case 'turnover': {
      const side = draft.side as TeamSide;
      // The backend stores a turnover as { teamId, playerId, turnoverType }.
      return {
        teamId: ctx.getTeamIdForSide(side),
        playerId: ctx.getPlayerId(side, draft.jersey as number),
        turnoverType: draft.turnoverType,
      };
    }
    case 'rebound': {
      const side = draft.side as TeamSide;
      return {
        teamId: ctx.getTeamIdForSide(side),
        reboundPlayerId: ctx.getPlayerId(side, draft.jersey as number),
        rebound: { type: draft.reboundType === 'offensive' ? 'offensive' : 'defensive' },
      };
    }
    case 'timeout': {
      // Who called it. An official/media timeout belongs to neither team, so it has no teamId — sent
      // as an explicit null because a shallow-merged correction can't remove a field otherwise.
      const choice = draft.choice as TeamSide | 'officials';
      if (choice === 'officials') return { timeoutType: 'official', teamId: null };
      return { teamId: ctx.getTeamIdForSide(choice), timeoutType: 'full' };
    }
    case 'jump ball': {
      const winner = draft.winner as TeamSide;
      return { winningTeamId: ctx.getTeamIdForSide(winner) };
    }
    default:
      return null;
  }
}

/**
 * A correction is written the way the server *stores* a play. A command that hasn't been sent yet
 * still has the shape the server *accepts*, and the two differ for turnovers — so translate before
 * patching a queued command with it.
 */
export function toCommandPayload(action: string, corrected: Record<string, unknown>): Record<string, unknown> {
  if (action !== 'turnover') return corrected;
  const { playerId, turnoverType, ...rest } = corrected;
  return {
    ...rest,
    ...(playerId !== undefined ? { turnoverPlayerId: playerId } : {}),
    ...(turnoverType !== undefined ? { turnover: { type: turnoverType } } : {}),
  };
}

/** Points a shot / free throw is worth as described by an edit draft (0 if it scores nothing). */
export function draftPoints(action: string, draft: CorrectionDraft, ctx: Pick<CorrectionContext, 'isThreePointer'>): { side: TeamSide; points: number } | null {
  if (action === 'shot') {
    const side = draft.side as TeamSide;
    if (draft.result !== 'made') return null;
    return { side, points: shotValueFor(draft, side, ctx) };
  }
  if (action === 'free throw') {
    if (draft.result !== 'made') return null;
    return { side: draft.shooterSide as TeamSide, points: 1 };
  }
  return null;
}

/** Score change caused by saving an edit: what the play scores now minus what it scored before. */
export function editScoreDelta(
  before: { side: TeamSide; points: number } | null,
  after: { side: TeamSide; points: number } | null,
): { home: number; away: number } {
  const delta = { home: 0, away: 0 };
  if (before) delta[before.side] -= before.points;
  if (after) delta[after.side] += after.points;
  return delta;
}

// ---------------------------------------------------------------------------------------------
// "Has anything changed?" — Save stays off until it has
// ---------------------------------------------------------------------------------------------

const DIRTY_KEYS: Record<string, string[]> = {
  substitution: ['outJersey', 'inJersey'],
  timeout: ['choice'],
  'jump ball': ['winner'],
  shot: ['shooterJersey', 'result', 'assistJersey'],
  foul: ['foulerJersey', 'fouledJersey'],
  'free throw': ['shooterJersey', 'result'],
  turnover: ['jersey'],
  rebound: ['jersey', 'reboundType'],
};

function normalize(key: string, value: unknown): unknown {
  if (key === 'result') return value === 'missed' ? 'missed' : 'made';
  if (key === 'assistJersey') return value ?? 'none';
  if (key === 'reboundType') return value === 'offensive' ? 'offensive' : 'defensive';
  return value ?? null;
}

/** True when the draft differs from what was recorded, for the fields this kind of play lets you change. */
export function isDraftDirty(action: string, initial: CorrectionDraft, current: CorrectionDraft): boolean {
  const keys = DIRTY_KEYS[action] ?? [];
  const stillMade = action === 'shot' ? normalize('result', current.result) === 'made' : true;
  return keys.some((key) => {
    // A miss can't have an assist, so a leftover assist choice on a missed shot isn't a change.
    if (key === 'assistJersey' && !stillMade) return false;
    return normalize(key, initial[key]) !== normalize(key, current[key]);
  });
}

// ---------------------------------------------------------------------------------------------
// Editing a substitution
// ---------------------------------------------------------------------------------------------

export type SubstitutionEditOptions =
  | { ok: true; outOptions: number[]; inOptions: number[] }
  | { ok: false; reason: string };

/**
 * What a substitution can be changed to. Editing takes the original swap back first, then applies the
 * new one, so it needs the players from the original swap to still be where that swap left them (the
 * one who came on still on the court, the one who went off still on the bench) — otherwise a later
 * substitution has changed things and has to be undone first.
 *
 * `outOptions` are who could have come off (the court once the original is taken back) and
 * `inOptions` who could have come on (the bench then).
 */
export function substitutionEditOptions(
  original: { outJersey: number; inJersey: number },
  onCourt: number[],
  roster: number[],
): SubstitutionEditOptions {
  if (!onCourt.includes(original.inJersey) || onCourt.includes(original.outJersey)) {
    return {
      ok: false,
      reason: `#${original.inJersey} or #${original.outJersey} has been substituted again since — undo the later substitution first, then edit this one.`,
    };
  }
  const courtAfterRevert = onCourt.map((j) => (j === original.inJersey ? original.outJersey : j));
  const bench = roster.filter((j) => !courtAfterRevert.includes(j));
  const sortNums = (a: number[]) => [...a].sort((x, y) => x - y);
  return { ok: true, outOptions: sortNums(courtAfterRevert), inOptions: sortNums(bench) };
}

