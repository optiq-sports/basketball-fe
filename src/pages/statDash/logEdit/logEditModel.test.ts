import { describe, expect, it } from 'vitest';
import type { QueuedEvent } from '../../../features/statdash/eventQueue/types';
import type { GameLogEntry } from '../types';
import {
  buildCorrectedPayload,
  canSwapBack,
  describeUndo,
  draftPoints,
  editScoreDelta,
  isEditableAction,
  planUndo,
  pointsOf,
  syncStateFor,
  type CorrectionContext,
} from './logEditModel';

const row = (over: Partial<GameLogEntry> & { id: string; action: string }): GameLogEntry => ({
  period: 'Q1', clock: '09:00', team: 'Sparks', player: '#1 A', result: '', ...over,
});

const queued = (localId: string, over: Partial<QueuedEvent> = {}): QueuedEvent => ({
  localId, sessionId: 's', commandType: 'shot', payload: {}, expectedVersion: 1, enqueuedAt: 1, status: 'sent', attempts: 1, ...over,
});

const names = { home: 'Sparks', away: 'Fresh Stars' };

describe('syncStateFor', () => {
  it('is synced once the row knows its real event id', () => {
    expect(syncStateFor(row({ id: 'r', action: 'shot', localId: 'a', backendEventId: 'evt' }), [])).toBe('synced');
  });
  it('is sending while the command is still queued or in flight', () => {
    expect(syncStateFor(row({ id: 'r', action: 'shot', localId: 'a' }), [queued('a', { status: 'pending' })])).toBe('sending');
    expect(syncStateFor(row({ id: 'r', action: 'shot', localId: 'a' }), [queued('a', { status: 'inflight' })])).toBe('sending');
  });
  it('is failed when the server rejected the command', () => {
    expect(syncStateFor(row({ id: 'r', action: 'shot', localId: 'a' }), [queued('a', { status: 'failed' })])).toBe('failed');
  });
  it('treats a row with nothing left to wait for as synced', () => {
    expect(syncStateFor(row({ id: 'r', action: 'shot' }), [])).toBe('synced');
    expect(syncStateFor(row({ id: 'r', action: 'shot', localId: 'gone' }), [])).toBe('synced');
  });
});

describe('pointsOf', () => {
  it('counts made shots at their value and made free throws as one', () => {
    expect(pointsOf(row({ id: 'r', action: 'shot', meta: { side: 'home', result: 'made', shotValue: 3 } }))).toEqual({ side: 'home', points: 3 });
    expect(pointsOf(row({ id: 'r', action: 'free throw', meta: { shooterSide: 'away', result: 'made' } }))).toEqual({ side: 'away', points: 1 });
  });
  it('counts nothing for misses and non-scoring plays', () => {
    expect(pointsOf(row({ id: 'r', action: 'shot', meta: { side: 'home', result: 'missed', shotValue: 3 } }))).toBeNull();
    expect(pointsOf(row({ id: 'r', action: 'rebound', meta: { side: 'home' } }))).toBeNull();
    expect(pointsOf(row({ id: 'r', action: 'assist', meta: { side: 'home' } }))).toBeNull();
  });
});

describe('isEditableAction', () => {
  it('allows every real play to be edited, and not the rows that belong to a parent play', () => {
    for (const a of ['shot', 'foul', 'free throw', 'turnover', 'rebound', 'substitution', 'timeout', 'jump ball']) {
      expect(isEditableAction(a)).toBe(true);
    }
    for (const a of ['assist', 'steal', 'block']) expect(isEditableAction(a)).toBe(false);
  });
});

describe('planUndo — local first, never waits for a sync', () => {
  const shotRow = row({ id: 'shot1', action: 'shot', localId: 'L1', meta: { side: 'home', result: 'made', shotValue: 3 } });
  const assistRow = row({ id: 'ast1', action: 'assist', localId: 'L1', meta: { side: 'home' } });

  it('a shot that has not been sent yet is just cancelled — no server call at all', () => {
    const plan = planUndo(shotRow, [assistRow, shotRow], [queued('L1', { status: 'pending' })]);
    expect(plan.cancelLocalIds).toEqual(['L1']);
    expect(plan.reversals).toEqual([]);
    expect(plan.removeRowIds.sort()).toEqual(['ast1', 'shot1']);
    expect(plan.scoreDelta).toEqual({ home: -3, away: 0 });
  });

  it('a shot the server rejected is cancelled locally too (nothing there to undo)', () => {
    const plan = planUndo(shotRow, [shotRow], [queued('L1', { status: 'failed' })]);
    expect(plan.cancelLocalIds).toEqual(['L1']);
    expect(plan.reversals).toEqual([]);
    expect(plan.scoreDelta.home).toBe(-3);
  });

  it('a shot already sent is reversed on the server, with the real id when known', () => {
    const synced = { ...shotRow, backendEventId: 'evt-1' };
    const plan = planUndo(synced, [synced, assistRow], [queued('L1', { status: 'sent', backendEventIds: ['evt-1'] })]);
    expect(plan.cancelLocalIds).toEqual([]);
    expect(plan.reversals).toEqual([{ targetLocalId: 'L1', targetBackendEventId: 'evt-1' }]);
    expect(plan.scoreDelta).toEqual({ home: -3, away: 0 });
  });

  it('a shot mid-send is reversed too — the undo waits its turn behind it in the queue', () => {
    const plan = planUndo(shotRow, [shotRow], [queued('L1', { status: 'inflight' })]);
    expect(plan.cancelLocalIds).toEqual([]);
    expect(plan.reversals).toEqual([{ targetLocalId: 'L1' }]);
  });

  it('a play restored after a reload (no queue entry) is reversed by its real id', () => {
    const restored = row({ id: 'r', action: 'shot', backendEventId: 'evt-9', meta: { side: 'away', result: 'made', shotValue: 2 } });
    const plan = planUndo(restored, [restored], []);
    expect(plan.reversals).toEqual([{ targetBackendEventId: 'evt-9' }]);
    expect(plan.scoreDelta).toEqual({ home: 0, away: -2 });
  });

  describe('a foul and its free throws', () => {
    const foul = row({ id: 'foul', action: 'foul', localId: 'F' });
    const ft1 = row({ id: 'ft1', action: 'free throw', localId: 'T1', meta: { shooterSide: 'home', result: 'made', parentLocalId: 'F' } });
    const ft2 = row({ id: 'ft2', action: 'free throw', localId: 'T2', meta: { shooterSide: 'home', result: 'made', parentLocalId: 'F' } });
    const ft3 = row({ id: 'ft3', action: 'free throw', localId: 'T3', meta: { shooterSide: 'home', result: 'missed', parentLocalId: 'F' } });

    it('one reversal for the foul covers its synced free throws; their points come off the score', () => {
      const q = [
        queued('F', { commandType: 'foul', backendEventIds: ['ef'] }),
        queued('T1', { commandType: 'free_throw', parentLocalId: 'F', backendEventIds: ['e1'] }),
        queued('T2', { commandType: 'free_throw', parentLocalId: 'F', backendEventIds: ['e2'] }),
      ];
      const plan = planUndo(foul, [foul, ft1, ft2, ft3], q);
      expect(plan.reversals).toHaveLength(1);
      expect(plan.reversals[0].targetLocalId).toBe('F');
      expect(plan.removeRowIds.sort()).toEqual(['foul', 'ft1', 'ft2', 'ft3']);
      expect(plan.scoreDelta).toEqual({ home: -2, away: 0 });
    });

    it('cancels free throws that were never sent, but reverses the foul that was', () => {
      const q = [
        queued('F', { commandType: 'foul', backendEventIds: ['ef'] }),
        queued('T1', { commandType: 'free_throw', parentLocalId: 'F', status: 'pending' }),
      ];
      const plan = planUndo(foul, [foul, ft1], q);
      expect(plan.cancelLocalIds).toEqual(['T1']);
      expect(plan.reversals).toEqual([{ targetLocalId: 'F', targetBackendEventId: 'ef' }]);
    });

    it('a foul that was never sent takes its free throws with it — nothing goes to the server', () => {
      const q = [
        queued('F', { commandType: 'foul', status: 'pending' }),
        queued('T1', { commandType: 'free_throw', parentLocalId: 'F', status: 'pending' }),
      ];
      const plan = planUndo(foul, [foul, ft1], q);
      expect(plan.cancelLocalIds.sort()).toEqual(['F', 'T1']);
      expect(plan.reversals).toEqual([]);
    });

    it('a free throw the server holds without a link to the foul is reversed on its own', () => {
      const q = [
        queued('F', { commandType: 'foul', status: 'failed' }),
        queued('T1', { commandType: 'free_throw', parentLocalId: 'F', backendEventIds: ['e1'] }),
      ];
      const plan = planUndo(foul, [foul, ft1], q);
      expect(plan.cancelLocalIds).toEqual(['F']);
      expect(plan.reversals).toEqual([{ targetLocalId: 'T1', targetBackendEventId: 'e1' }]);
    });
  });

  describe('a substitution is undone by swapping the players back', () => {
    const sub = row({ id: 'sub', action: 'substitution', localId: 'S', meta: { side: 'home', outJersey: 16, inJersey: 12 } });

    it('never reverses the event (that would not restore the lineup)', () => {
      const plan = planUndo(sub, [sub], [queued('S', { commandType: 'substitution', backendEventIds: ['es'] })]);
      expect(plan.reversals).toEqual([]);
      expect(plan.substitution).toEqual({ swap: { side: 'home', outJersey: 12, inJersey: 16 }, cancelOnly: false });
    });

    it('one still waiting to be sent is NOT dropped (later subs assume it happened) — it is undone by a lineup command', () => {
      const plan = planUndo(sub, [sub], [queued('S', { commandType: 'substitution', status: 'pending' })]);
      expect(plan.cancelLocalIds).toEqual([]);
      expect(plan.substitution?.cancelOnly).toBe(false);
    });

    it('only one the server rejected is dropped, since it never took effect there', () => {
      const plan = planUndo(sub, [sub], [queued('S', { commandType: 'substitution', status: 'failed' })]);
      expect(plan.cancelLocalIds).toEqual(['S']);
      expect(plan.substitution?.cancelOnly).toBe(true);
    });
  });

  it('other plays (a timeout) are reversed like any other event', () => {
    const t = row({ id: 't', action: 'timeout', localId: 'TO' });
    const plan = planUndo(t, [t], [queued('TO', { commandType: 'timeout', backendEventIds: ['et'] })]);
    expect(plan.reversals).toEqual([{ targetLocalId: 'TO', targetBackendEventId: 'et' }]);
  });
});

describe('canSwapBack', () => {
  const swap = { side: 'home' as const, outJersey: 12, inJersey: 16 };
  it('allows it when the player who came on is still on the court and the one who left is on the bench', () => {
    expect(canSwapBack(swap, [12, 3, 4, 5, 6])).toEqual({ ok: true });
  });
  it('explains when a later substitution already moved the player who came on', () => {
    const r = canSwapBack(swap, [3, 4, 5, 6, 7]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/#12/);
  });
  it('refuses when the player to bring back is already on the court', () => {
    expect(canSwapBack(swap, [12, 16, 4, 5, 6]).ok).toBe(false);
  });
});

describe('describeUndo', () => {
  it('says what will happen in plain words, including the points', () => {
    const shot = row({ id: 's', action: 'shot', localId: 'L', meta: { side: 'home', result: 'made', shotValue: 3 } });
    const plan = planUndo(shot, [shot], [queued('L', { status: 'pending' })]);
    expect(describeUndo(shot, plan, names)).toBe('Removes this shot from the game log, takes 3 points off Sparks.');
  });
  it('mentions the free throws that go with a foul', () => {
    const foul = row({ id: 'f', action: 'foul', localId: 'F' });
    const ft = row({ id: 't', action: 'free throw', localId: 'T', meta: { shooterSide: 'away', result: 'made', parentLocalId: 'F' } });
    const plan = planUndo(foul, [foul, ft], [queued('F', { status: 'pending' }), queued('T', { status: 'pending', parentLocalId: 'F' })]);
    expect(describeUndo(foul, plan, names)).toBe('Removes this foul from the game log, takes 1 point off Fresh Stars, and removes the free throws that came from it.');
  });
  it('describes a substitution as putting the players back', () => {
    const sub = row({ id: 'x', action: 'substitution', localId: 'S', meta: { side: 'home', outJersey: 16, inJersey: 12 } });
    const plan = planUndo(sub, [sub], [queued('S', { status: 'sent' })]);
    expect(describeUndo(sub, plan, names)).toBe('Puts #16 back on the court and #12 back on the bench.');
  });
});

describe('buildCorrectedPayload', () => {
  const ctx: CorrectionContext = {
    getPlayerId: (side, jersey) => `${side}-${jersey}`,
    getTeamIdForSide: (side) => `team-${side}`,
    // Anything on x < 0.2 counts as beyond the arc for the test.
    isThreePointer: (x) => x < 0.2,
    shotTypeToApiType: (t) => t.replace(' ', '_'),
  };

  describe('shot', () => {
    const original = { teamId: 'team-home', shooterPlayerId: 'home-7', assistPlayerId: 'home-4', shot: { value: 2, result: 'made', type: 'layup', playType: 'fast_break', x: 0.4, y: 0.5 } };

    it('REGRESSION: a made→missed change goes into the nested shot object the backend reads, not top-level keys it ignores', () => {
      const payload = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'missed', x: 0.4, y: 0.5 }, original, ctx)!;
      expect(payload.shot).toMatchObject({ result: 'missed', value: 2 });
      expect(payload).not.toHaveProperty('result');
      expect(payload).not.toHaveProperty('shotValue');
      expect(payload).not.toHaveProperty('x');
    });

    it('keeps the parts of the original shot the edit did not touch', () => {
      const payload = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'made', x: 0.4, y: 0.5 }, original, ctx)!;
      expect(payload.shot).toEqual({ value: 2, result: 'made', type: 'layup', playType: 'fast_break', x: 0.4, y: 0.5 });
    });

    it('derives the point value from where the shot was taken', () => {
      const payload = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'made', x: 0.1, y: 0.5 }, original, ctx)!;
      expect((payload.shot as { value: number }).value).toBe(3);
    });

    it('keeps the recorded value when no court position was recorded', () => {
      const payload = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'made', shotValue: 3 }, undefined, ctx)!;
      expect((payload.shot as { value: number }).value).toBe(3);
    });

    it('an assist can be added or changed, and is explicitly cleared (null) when removed or when the shot becomes a miss', () => {
      const withAssist = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'made', assistJersey: 9, x: 0.4, y: 0.5 }, original, ctx)!;
      expect(withAssist.assistPlayerId).toBe('home-9');
      const none = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'made', assistJersey: 'none', x: 0.4, y: 0.5 }, original, ctx)!;
      expect(none.assistPlayerId).toBeNull();
      const missed = buildCorrectedPayload('shot', { side: 'home', shooterJersey: 7, result: 'missed', assistJersey: 9, x: 0.4, y: 0.5 }, original, ctx)!;
      expect(missed.assistPlayerId).toBeNull();
    });

    it('changes the shooter and team', () => {
      const payload = buildCorrectedPayload('shot', { side: 'away', shooterJersey: 22, result: 'made', x: 0.4, y: 0.5 }, original, ctx)!;
      expect(payload.shooterPlayerId).toBe('away-22');
      expect(payload.teamId).toBe('team-away');
    });
  });

  it('free throw keeps its stored shape', () => {
    expect(buildCorrectedPayload('free throw', { shooterSide: 'home', shooterJersey: 7, attempt: 2, totalAttempts: 3, result: 'missed' }, undefined, ctx)).toEqual({
      teamId: 'team-home', shooterPlayerId: 'home-7', attempt: 2, totalAttempts: 3, result: 'missed',
    });
  });

  it('turnover is written the way the backend stores it (playerId / turnoverType)', () => {
    expect(buildCorrectedPayload('turnover', { side: 'away', jersey: 5, turnoverType: 'bad_pass' }, undefined, ctx)).toEqual({
      teamId: 'team-away', playerId: 'away-5', turnoverType: 'bad_pass',
    });
  });

  it('rebound uses the nested type and the reboundPlayerId the backend reads', () => {
    expect(buildCorrectedPayload('rebound', { side: 'home', jersey: 9, reboundType: 'offensive' }, undefined, ctx)).toEqual({
      teamId: 'team-home', reboundPlayerId: 'home-9', rebound: { type: 'offensive' },
    });
  });

  it('foul sends the fouler team and both players', () => {
    expect(buildCorrectedPayload('foul', { foulerSide: 'home', foulerJersey: 7, fouledJersey: 22, foulType: 'shooting' }, undefined, ctx)).toEqual({
      teamId: 'team-home', foulerPlayerId: 'home-7', fouledPlayerId: 'away-22', foulType: 'shooting',
    });
  });

  it('returns null for rows that have no correction of their own (an assist belongs to its shot; a substitution is changed with a lineup command, not a correction)', () => {
    expect(buildCorrectedPayload('assist', {}, undefined, ctx)).toBeNull();
    expect(buildCorrectedPayload('substitution', {}, undefined, ctx)).toBeNull();
  });
});

describe('score change from saving an edit', () => {
  const ctx = { isThreePointer: (x: number) => x < 0.2 };
  it('made → missed takes the points off', () => {
    const before = { side: 'home' as const, points: 3 };
    const after = draftPoints('shot', { side: 'home', result: 'missed' }, ctx);
    expect(editScoreDelta(before, after)).toEqual({ home: -3, away: 0 });
  });
  it('missed → made puts the points on', () => {
    expect(editScoreDelta(null, draftPoints('shot', { side: 'away', result: 'made', x: 0.5, y: 0.5 }, ctx))).toEqual({ home: 0, away: 2 });
  });
  it('a free throw made → missed takes one off', () => {
    expect(editScoreDelta({ side: 'home', points: 1 }, draftPoints('free throw', { shooterSide: 'home', result: 'missed' }, ctx))).toEqual({ home: -1, away: 0 });
  });
  it('an edit that does not change the points changes nothing', () => {
    expect(editScoreDelta({ side: 'home', points: 2 }, { side: 'home', points: 2 })).toEqual({ home: 0, away: 0 });
  });
});

import { isDraftDirty } from './logEditModel';

describe('isDraftDirty — Save stays off until something really changed', () => {
  const shot = { side: 'home', shooterJersey: 7, result: 'made', assistJersey: 4 };
  it('is clean when nothing changed', () => {
    expect(isDraftDirty('shot', shot, { ...shot })).toBe(false);
  });
  it('is dirty when the shooter, result or assist changes', () => {
    expect(isDraftDirty('shot', shot, { ...shot, shooterJersey: 9 })).toBe(true);
    expect(isDraftDirty('shot', shot, { ...shot, result: 'missed' })).toBe(true);
    expect(isDraftDirty('shot', shot, { ...shot, assistJersey: 'none' })).toBe(true);
  });
  it('treats "no assist" spelled two ways as the same thing', () => {
    expect(isDraftDirty('shot', { ...shot, assistJersey: undefined }, { ...shot, assistJersey: 'none' })).toBe(false);
  });
  it('ignores a leftover assist choice on a missed shot', () => {
    const missed = { ...shot, result: 'missed', assistJersey: 'none' };
    expect(isDraftDirty('shot', missed, { ...missed, assistJersey: 9 })).toBe(false);
  });
  it('checks the right fields for other plays', () => {
    expect(isDraftDirty('rebound', { jersey: 5, reboundType: 'defensive' }, { jersey: 5, reboundType: 'offensive' })).toBe(true);
    expect(isDraftDirty('foul', { foulerJersey: 5, fouledJersey: 9 }, { foulerJersey: 5, fouledJersey: 9 })).toBe(false);
    expect(isDraftDirty('free throw', { shooterJersey: 5, result: 'made' }, { shooterJersey: 5, result: 'missed' })).toBe(true);
  });
  it('plays that can not be edited are never dirty', () => {
    expect(isDraftDirty('substitution', {}, { anything: 1 })).toBe(false);
  });
});

import { substitutionEditOptions } from './logEditModel';

describe('editing a timeout or jump ball', () => {
  const ctx: CorrectionContext = {
    getPlayerId: (side, jersey) => `${side}-${jersey}`,
    getTeamIdForSide: (side) => `team-${side}`,
    isThreePointer: () => false,
  };
  it('a team timeout carries that team; an official one has no team, sent as an explicit null so the old team is cleared', () => {
    expect(buildCorrectedPayload('timeout', { choice: 'away' }, undefined, ctx)).toEqual({ teamId: 'team-away', timeoutType: 'full' });
    expect(buildCorrectedPayload('timeout', { choice: 'officials' }, undefined, ctx)).toEqual({ timeoutType: 'official', teamId: null });
  });
  it('a jump ball changes its winner', () => {
    expect(buildCorrectedPayload('jump ball', { winner: 'away' }, undefined, ctx)).toEqual({ winningTeamId: 'team-away' });
  });
  it('knows when they changed', () => {
    expect(isDraftDirty('timeout', { choice: 'home' }, { choice: 'officials' })).toBe(true);
    expect(isDraftDirty('timeout', { choice: 'home' }, { choice: 'home' })).toBe(false);
    expect(isDraftDirty('jump ball', { winner: 'home' }, { winner: 'away' })).toBe(true);
    expect(isDraftDirty('substitution', { outJersey: 16, inJersey: 12 }, { outJersey: 16, inJersey: 9 })).toBe(true);
    expect(isDraftDirty('substitution', { outJersey: 16, inJersey: 12 }, { outJersey: 16, inJersey: 12 })).toBe(false);
  });
});

describe('substitutionEditOptions', () => {
  const roster = [3, 4, 5, 7, 9, 10, 12, 16, 23];
  // The sub was "out #16, in #12": 12 is on the court now, 16 on the bench.
  const onCourt = [3, 4, 5, 7, 12];

  it('offers, as who came off, everyone on the court once the original sub is taken back — including the original player', () => {
    const r = substitutionEditOptions({ outJersey: 16, inJersey: 12 }, onCourt, roster);
    expect(r).toEqual({ ok: true, outOptions: [3, 4, 5, 7, 16], inOptions: [9, 10, 12, 23] });
  });

  it('offers, as who came on, everyone on the bench at that point — including the original player', () => {
    const r = substitutionEditOptions({ outJersey: 16, inJersey: 12 }, onCourt, roster);
    expect(r.ok && r.inOptions).toContain(12);
  });

  it('refuses, and says why, once a later substitution has moved one of the players', () => {
    const later = [3, 4, 5, 7, 9]; // 12 went off again
    const r = substitutionEditOptions({ outJersey: 16, inJersey: 12 }, later, roster);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/undo the later substitution first/i);
  });
});
