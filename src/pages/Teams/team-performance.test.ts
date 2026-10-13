import { describe, expect, it } from 'vitest';
import { hasFinalScore, teamPerformanceByTournament, teamSummary, type TeamMatchForPerformance } from './team-performance';

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

describe('teamSummary', () => {
  const g = (isHome: boolean, f: number, a: number, date: string): TeamMatchForPerformance => ({ tournamentId: 't1', isHome, homeScore: isHome ? f : a, awayScore: isHome ? a : f, status: 'COMPLETED', scheduledDate: date });

  it('is empty, with no percentages, before a first game', () => {
    expect(teamSummary([])).toMatchObject({ played: 0, winPct: null, ppg: null, papg: null, streak: null });
  });

  it('adds up wins, losses, home and away records and per-game points', () => {
    const s = teamSummary([g(true, 80, 70, '2026-09-01'), g(false, 60, 75, '2026-09-08'), g(true, 90, 50, '2026-09-15')]);
    expect(s).toMatchObject({ played: 3, wins: 2, losses: 1, winPct: 66.7, home: { w: 2, l: 0 }, away: { w: 0, l: 1 }, ppg: 76.7, papg: 65 });
  });

  it('finds the current streak from the latest game back, whatever order the games arrive in', () => {
    const s = teamSummary([g(true, 90, 50, '2026-09-15'), g(true, 60, 70, '2026-09-01'), g(true, 80, 70, '2026-09-08')]);
    expect(s.streak).toEqual({ kind: 'W', count: 2 });
  });

  it('leaves out a finished game stored as 0 – 0 rather than inventing a tie (Gap 47)', () => {
    expect(hasFinalScore({ status: 'COMPLETED', homeScore: 0, awayScore: 0 })).toBe(false);
    expect(teamSummary([g(true, 0, 0, '2026-09-01'), g(true, 80, 70, '2026-09-08')]).played).toBe(1);
  });

  it('ignores games that are not finished', () => {
    expect(teamSummary([{ tournamentId: 't1', isHome: true, homeScore: 10, awayScore: 5, status: 'LIVE' }]).played).toBe(0);
  });
});
