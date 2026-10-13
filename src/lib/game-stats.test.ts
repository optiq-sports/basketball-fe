import { describe, expect, it } from 'vitest';
import { leaderOf, pct, teamShooting, teamTotals } from './game-stats';
import type { BoxScoreRow } from '../components/client/BoxScoreTable';

const row = (name: string, over: Partial<BoxScoreRow> = {}): BoxScoreRow => ({
  playerId: name, name, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fouls: 0, turnovers: 0, ...over,
});

describe('teamShooting', () => {
  const shots = [
    { teamId: 'h', result: 'made', shotValue: 2 },
    { teamId: 'h', result: 'missed', shotValue: 2 },
    { teamId: 'h', result: 'made', shotValue: 3 },
    { teamId: 'a', result: 'missed', shotValue: 3 },
    { teamId: 'h', result: null, shotValue: 2 },
  ];

  it('counts made and attempted for the team, split into twos and threes', () => {
    expect(teamShooting(shots, 'h')).toEqual({ fgm: 2, fga: 3, twoM: 1, twoA: 2, threeM: 1, threeA: 1 });
  });

  it('ignores shots with no result and shots by the other team', () => {
    expect(teamShooting(shots, 'a')).toEqual({ fgm: 0, fga: 1, twoM: 0, twoA: 0, threeM: 0, threeA: 1 });
  });

  it('counts a shot with an unknown value as a field goal but not as a two or three', () => {
    expect(teamShooting([{ teamId: 'h', result: 'made', shotValue: null }], 'h')).toEqual({ fgm: 1, fga: 1, twoM: 0, twoA: 0, threeM: 0, threeA: 0 });
  });

  it('is all zeros without a team id', () => {
    expect(teamShooting(shots, undefined).fga).toBe(0);
  });
});

describe('pct', () => {
  it('rounds to one decimal', () => expect(pct(13, 21)).toBe(61.9));
  it('is null, not 0, with no attempts', () => expect(pct(0, 0)).toBeNull());
});

describe('teamTotals and leaderOf', () => {
  const rows = [row('Ana', { points: 12, rebounds: 3, fouls: 1 }), row('Bea', { points: 12, rebounds: 5, turnovers: 2 })];

  it('sums each stat across the team', () => {
    expect(teamTotals(rows)).toMatchObject({ points: 24, rebounds: 8, fouls: 1, turnovers: 2 });
  });

  it('picks the top player, breaking ties by name', () => {
    expect(leaderOf(rows, 'points')?.name).toBe('Ana');
    expect(leaderOf(rows, 'rebounds')?.name).toBe('Bea');
  });

  it('has no leader when nobody has any', () => {
    expect(leaderOf(rows, 'blocks')).toBeNull();
  });
});
