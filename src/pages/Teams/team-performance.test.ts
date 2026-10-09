import { describe, expect, it } from 'vitest';
import { teamPerformanceByTournament, type TeamMatchForPerformance } from './team-performance';

const tournaments = [{ id: 't1', name: 'Summer Cup' }, { id: 't2', name: 'Winter League' }];
const m = (tournamentId: string, isHome: boolean, hs: number, as_: number, status = 'COMPLETED'): TeamMatchForPerformance => ({ tournamentId, isHome, homeScore: hs, awayScore: as_, status });

describe('teamPerformanceByTournament', () => {
  it('gives every tournament the team is in a row, even with no games played', () => {
    const rows = teamPerformanceByTournament(tournaments, []);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.gp === 0 && r.pct === 0)).toBe(true);
  });

  it('counts a win or loss correctly whether the team was home or away', () => {
    const rows = teamPerformanceByTournament(tournaments, [m('t1', true, 80, 70), m('t1', false, 60, 75)]);
    const t1 = rows.find((r) => r.tournamentId === 't1')!;
    expect(t1).toMatchObject({ gp: 2, w: 2, l: 0, pct: 100, pointsFor: 155, pointsAgainst: 130 }); // 80 (home) + 75 (away) for; 70 + 60 against
  });

  it('ignores games that have not been completed, or are missing a score', () => {
    const rows = teamPerformanceByTournament(tournaments, [m('t1', true, 80, 70, 'SCHEDULED'), { tournamentId: 't1', isHome: true, homeScore: null, awayScore: 10, status: 'COMPLETED' }]);
    expect(rows.find((r) => r.tournamentId === 't1')?.gp).toBe(0);
  });

  it('ignores a match in a tournament the team is no longer linked to', () => {
    const rows = teamPerformanceByTournament(tournaments, [m('gone', true, 80, 70)]);
    expect(rows.every((r) => r.gp === 0)).toBe(true);
  });

  it('sorts tournaments by name', () => {
    const rows = teamPerformanceByTournament(tournaments, []);
    expect(rows.map((r) => r.tournamentName)).toEqual(['Summer Cup', 'Winter League']);
  });
});
