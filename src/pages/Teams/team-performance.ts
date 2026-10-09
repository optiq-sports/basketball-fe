/**
 * A team's real record in each tournament it's in, from its own matches. Replaces a fabricated
 * "season stats" table that showed invented wins, losses and scores with no backend source (Fix 105).
 */

export interface TeamTournamentRef {
  id: string;
  name: string;
}

export interface TeamMatchForPerformance {
  tournamentId: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Whether this team was the home side in this match. */
  isHome: boolean;
}

export interface TeamPerformanceRow {
  tournamentId: string;
  tournamentName: string;
  gp: number;
  w: number;
  l: number;
  /** Win percentage, 0–100, one decimal. */
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
}

/**
 * One row per tournament the team belongs to, even one it hasn't played a game in yet (0 GP). Only
 * COMPLETED matches with both scores count. An exact tie counts as played with no winner.
 */
export function teamPerformanceByTournament(tournaments: TeamTournamentRef[], matches: TeamMatchForPerformance[]): TeamPerformanceRow[] {
  const rows = new Map<string, TeamPerformanceRow>();
  for (const t of tournaments) rows.set(t.id, { tournamentId: t.id, tournamentName: t.name, gp: 0, w: 0, l: 0, pct: 0, pointsFor: 0, pointsAgainst: 0 });

  for (const m of matches) {
    if (m.status !== 'COMPLETED' || m.homeScore == null || m.awayScore == null) continue;
    const row = rows.get(m.tournamentId);
    if (!row) continue; // a match in a tournament this team is no longer linked to
    const [forScore, againstScore] = m.isHome ? [m.homeScore, m.awayScore] : [m.awayScore, m.homeScore];
    row.gp += 1;
    row.pointsFor += forScore;
    row.pointsAgainst += againstScore;
    if (forScore > againstScore) row.w += 1;
    else if (againstScore > forScore) row.l += 1;
  }

  for (const row of rows.values()) row.pct = row.gp > 0 ? Math.round((row.w / row.gp) * 1000) / 10 : 0;
  return [...rows.values()].sort((a, b) => a.tournamentName.localeCompare(b.tournamentName));
}
