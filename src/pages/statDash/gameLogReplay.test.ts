import { describe, expect, it } from 'vitest';
import { buildGameLogFromEvents, type GameLogReplayContext, type ReplayableEvent } from './gameLogReplay';
import { buildCorrectedPayload, isDraftDirty, toCommandPayload, type CorrectionContext } from './logEdit/logEditModel';

const players: Record<string, { side: 'home' | 'away'; jersey: number }> = {
  h30: { side: 'home', jersey: 30 },
  h7: { side: 'home', jersey: 7 },
  a5: { side: 'away', jersey: 5 },
  a12: { side: 'away', jersey: 12 },
  a16: { side: 'away', jersey: 16 },
};

const ctx: GameLogReplayContext = {
  homeTeamId: 'T-home',
  awayTeamId: 'T-away',
  homeName: 'Stars',
  awayName: 'Sparks',
  resolvePlayer: (id) => players[id as string] ?? null,
  getPlayerLabel: (side, jersey) => `${side}#${jersey}`,
};

const ev = (id: string, eventType: string, payload: Record<string, unknown>): ReplayableEvent => ({
  id,
  sequence: 1,
  eventType,
  payload,
  createdAt: new Date().toISOString(),
});

const correctionCtx: CorrectionContext = {
  getTeamIdForSide: (s) => (s === 'home' ? 'T-home' : 'T-away'),
  getPlayerId: (s, j) => `${s === 'home' ? 'h' : 'a'}${j}`,
  isThreePointer: () => false,
  shotTypeToApiType: (t) => ({ jump: 'jump_shot', layup: 'layup', dunk: 'dunk', post: 'post_shot' })[t] ?? t,
};

describe('rows restored after a reload can be edited', () => {
  it('a shot carries who took it, its type, value and assist', () => {
    const [row, assist] = buildGameLogFromEvents(
      [ev('e1', 'shot', { teamId: 'T-home', shooterPlayerId: 'h30', assistPlayerId: 'h7', shot: { type: 'dunk', value: 2, result: 'made' } })],
      ctx,
    ).sort((a) => (a.action === 'shot' ? -1 : 1));
    expect(row.meta).toMatchObject({ side: 'home', shooterJersey: 30, shotType: 'dunk', shotValue: 2, result: 'made', assistJersey: 7 });
    expect(assist.action).toBe('assist');
  });

  it('a shot without an assist says so', () => {
    const [row] = buildGameLogFromEvents([ev('e1', 'shot', { teamId: 'T-home', shooterPlayerId: 'h30', shot: { type: 'layup', value: 2, result: 'made' } })], ctx);
    expect(row.meta?.assistJersey).toBe('none');
  });

  it('changing a restored shot to a miss keeps its type', () => {
    const [row] = buildGameLogFromEvents(
      [ev('e1', 'shot', { teamId: 'T-home', shooterPlayerId: 'h30', shot: { type: 'post_shot', value: 2, result: 'made' } })],
      ctx,
    );
    const draft = { ...row.meta, result: 'missed' };
    expect(isDraftDirty('shot', row.meta!, draft)).toBe(true);
    const corrected = buildCorrectedPayload('shot', draft, row.meta!.originalPayload as Record<string, unknown>, correctionCtx);
    expect(corrected).toMatchObject({ shooterPlayerId: 'h30', shot: { type: 'post_shot', result: 'missed', value: 2 } });
  });

  it('a turnover is read from the way the server stores it', () => {
    const [row] = buildGameLogFromEvents([ev('e1', 'turnover', { teamId: 'T-away', playerId: 'a5', turnoverType: 'bad_pass' })], ctx);
    expect(row.player).toBe('away#5');
    expect(row.result).toBe('Bad pass');
    expect(row.meta).toMatchObject({ side: 'away', jersey: 5, turnoverType: 'bad_pass' });
  });

  it('a turnover still in the command shape reads the same', () => {
    const [row] = buildGameLogFromEvents([ev('e1', 'turnover', { teamId: 'T-away', turnoverPlayerId: 'a5', turnover: { type: 'travel' } })], ctx);
    expect(row.meta).toMatchObject({ side: 'away', jersey: 5, turnoverType: 'travel' });
  });

  it('a correction to a turnover that has not been sent yet uses the command shape', () => {
    const corrected = buildCorrectedPayload('turnover', { side: 'away', jersey: 12, turnoverType: 'travel' }, undefined, correctionCtx);
    expect(toCommandPayload('turnover', corrected!)).toEqual({
      teamId: 'T-away',
      turnoverPlayerId: 'a12',
      turnover: { type: 'travel' },
    });
    expect(toCommandPayload('shot', { a: 1 })).toEqual({ a: 1 });
  });

  it('a substitution carries the swap', () => {
    const [row] = buildGameLogFromEvents([ev('e1', 'substitution', { teamId: 'T-away', playerOutId: 'a16', playerInId: 'a12' })], ctx);
    expect(row.meta).toMatchObject({ side: 'away', outJersey: 16, inJersey: 12 });
  });

  it('a foul, free throw, rebound, timeout and jump ball carry their details', () => {
    const rows = buildGameLogFromEvents(
      [
        ev('f', 'foul', { teamId: 'T-away', foulerPlayerId: 'a5', fouledPlayerId: 'h7', foulType: 'unsportsmanlike' }),
        ev('t', 'free_throw', { teamId: 'T-home', shooterPlayerId: 'h7', attempt: 1, totalAttempts: 2, result: 'missed' }),
        ev('r', 'rebound', { teamId: 'T-home', reboundPlayerId: 'h30', rebound: { type: 'offensive' } }),
        ev('o', 'timeout', { teamId: 'T-away', timeoutType: 'full' }),
        ev('j', 'jump_ball', { winningTeamId: 'T-away' }),
      ],
      ctx,
    );
    const by = (a: string) => rows.find((r) => r.action === a)!.meta;
    expect(by('foul')).toMatchObject({ foulerSide: 'away', foulerJersey: 5, foulType: 'unsportmanlike', fouledJersey: 7 });
    expect(by('free throw')).toMatchObject({ shooterSide: 'home', shooterJersey: 7, attempt: 1, totalAttempts: 2, result: 'missed' });
    expect(by('rebound')).toMatchObject({ side: 'home', jersey: 30, reboundType: 'offensive' });
    expect(by('timeout')).toMatchObject({ choice: 'away' });
    expect(by('jump ball')).toMatchObject({ winner: 'away' });
  });

  it('an official timeout is edited as officials', () => {
    const [row] = buildGameLogFromEvents([ev('o', 'timeout', { timeoutType: 'official' })], ctx);
    expect(row.meta).toMatchObject({ choice: 'officials' });
  });
});
