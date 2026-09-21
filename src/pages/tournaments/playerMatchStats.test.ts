import { describe, expect, it } from 'vitest';
import { pickGameSessionId, pickPlayerStats, type StatLine } from './playerMatchStats';

const line = (points: number, extra: Partial<StatLine> = {}): StatLine => ({
  points, rebounds: 0, assists: 0, blocks: 0, steals: 0, fouls: 0, turnovers: 0, ...extra,
});

describe('pickPlayerStats', () => {
  it('prefers the live projection over the saved record while the game is live', () => {
    const result = pickPlayerStats({ isLive: true, saved: line(2), projection: line(5) });
    expect(result).toEqual({ stats: line(5), source: 'live' });
  });

  it('shows the live projection even when it is all zeros (a live game, nothing yet)', () => {
    const result = pickPlayerStats({ isLive: true, saved: null, projection: line(0) });
    expect(result?.source).toBe('live');
  });

  it('falls back to the saved record when live but the projection has not loaded / failed', () => {
    expect(pickPlayerStats({ isLive: true, saved: line(2), projection: undefined })).toEqual({
      stats: line(2),
      source: 'saved',
    });
  });

  it('uses the saved record for a finished game, ignoring the projection', () => {
    const result = pickPlayerStats({ isLive: false, saved: line(10), projection: line(99) });
    expect(result).toEqual({ stats: line(10), source: 'saved' });
  });

  it('falls back to the projection for a finished game with nothing saved, if it has data', () => {
    expect(pickPlayerStats({ isLive: false, saved: null, projection: line(0, { rebounds: 4 }) })).toEqual({
      stats: line(0, { rebounds: 4 }),
      source: 'projection',
    });
  });

  it('shows nothing for a finished game where the projection is only the backend\'s all-zero default', () => {
    expect(pickPlayerStats({ isLive: false, saved: null, projection: line(0) })).toBeNull();
  });

  it('shows nothing when there is no data at all', () => {
    expect(pickPlayerStats({ isLive: false, saved: undefined, projection: undefined })).toBeNull();
  });
});

describe('pickGameSessionId', () => {
  it('returns undefined when there are no sessions', () => {
    expect(pickGameSessionId(undefined)).toBeUndefined();
    expect(pickGameSessionId([])).toBeUndefined();
  });

  it('prefers the session being played over an older one', () => {
    expect(
      pickGameSessionId([
        { id: 'old', status: 'COMPLETED' },
        { id: 'now', status: 'IN_PROGRESS' },
      ]),
    ).toBe('now');
  });

  it('treats a paused session as the active one', () => {
    expect(pickGameSessionId([{ id: 'a', status: 'CANCELLED' }, { id: 'b', status: 'PAUSED' }])).toBe('b');
  });

  it('otherwise takes the first session', () => {
    expect(pickGameSessionId([{ id: 'a', status: 'COMPLETED' }, { id: 'b', status: 'CANCELLED' }])).toBe('a');
  });
});
