import { describe, expect, it } from 'vitest';
import { computeStandings, leadersFrom, type LeaderMatch, type StandingsMatch } from './standings';

const teams = [
  { id: 'a', name: 'Alpha', group: 'A' },
  { id: 'b', name: 'Bravo', group: 'A' },
  { id: 'c', name: 'Charlie', group: 'B' },
];

const game = (home: string, away: string, hs: number, as_: number, status = 'COMPLETED'): StandingsMatch => ({
  homeTeamId: home,
  awayTeamId: away,
  homeScore: hs,
  awayScore: as_,
  status,
});

describe('computeStandings', () => {
  it('counts only completed games, with 2 points per win', () => {
    const rows = computeStandings(teams, [
      game('a', 'b', 80, 70),
      game('b', 'c', 60, 75),
      game('a', 'c', 50, 40, 'SCHEDULED'), // not played yet: not counted
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.a).toMatchObject({ gp: 1, w: 1, l: 0, points: 2, pct: 100 });
    expect(byId.b).toMatchObject({ gp: 2, w: 0, l: 2, points: 0, pct: 0 });
    expect(byId.c).toMatchObject({ gp: 1, w: 1, l: 0, points: 2 });
  });

  it('ranks by points, then win percentage, then name', () => {
    const rows = computeStandings(teams, [game('a', 'b', 80, 70), game('c', 'a', 90, 60)]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b']); // c and a both 2 pts; c has 100% from one game, a has 50%
  });

  it('gives a team with no games a zero row rather than dropping it', () => {
    const rows = computeStandings(teams, []);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.gp === 0 && r.pct === 0)).toBe(true);
  });

  it('ignores a match against a team that is no longer in the tournament', () => {
    const rows = computeStandings(teams, [game('a', 'gone', 80, 70)]);
    expect(rows.find((r) => r.id === 'a')?.gp).toBe(0);
  });

  it('does not count a game with a missing score', () => {
    const rows = computeStandings(teams, [{ homeTeamId: 'a', awayTeamId: 'b', homeScore: null, awayScore: 3, status: 'COMPLETED' }]);
    expect(rows.every((r) => r.gp === 0)).toBe(true);
  });
});

describe('leadersFrom', () => {
  const matches: LeaderMatch[] = [
    {
      status: 'COMPLETED',
      stats: [
        { playerId: 'p1', points: 20, player: { firstName: 'Ana', lastName: 'Guard' } },
        { playerId: 'p2', points: 9, player: { firstName: 'Ben', lastName: 'Wing' } },
      ],
    },
    {
      status: 'COMPLETED',
      stats: [{ playerId: 'p1', points: 12, player: { firstName: 'Ana', lastName: 'Guard' } }],
    },
    {
      status: 'SCHEDULED',
      stats: [{ playerId: 'p2', points: 99, player: { firstName: 'Ben', lastName: 'Wing' } }],
    },
  ];

  it('totals and averages each player over completed games only', () => {
    const rows = leadersFrom(matches, 'points', new Map());
    expect(rows[0]).toMatchObject({ playerId: 'p1', name: 'Ana Guard', gp: 2, total: 32, avg: 16 });
    expect(rows[1]).toMatchObject({ playerId: 'p2', gp: 1, total: 9 });
  });

  it('ranks by the stat asked for', () => {
    const withAssists: LeaderMatch[] = [{ status: 'COMPLETED', stats: [{ playerId: 'p2', assists: 7, player: null }, { playerId: 'p1', assists: 2, player: null }] }];
    expect(leadersFrom(withAssists, 'assists', new Map())[0].playerId).toBe('p2');
    expect(leadersFrom(withAssists, 'assists', new Map())[0].name).toBe('Unknown player');
  });

  it('caps the list', () => {
    const many: LeaderMatch[] = [{ status: 'COMPLETED', stats: Array.from({ length: 9 }, (_, i) => ({ playerId: `p${i}`, points: i, player: null })) }];
    expect(leadersFrom(many, 'points', new Map(), 3)).toHaveLength(3);
  });
});
