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
  /** Used to put games in order for a streak. */
  scheduledDate?: string;
}

/**
 * A finished game with a usable score. A COMPLETED game stored as 0 – 0 hasn't had its score written to
 * the match (Gap 47); counting it would invent a tie, so it is left out until the score is there.
 */
export const hasFinalScore = <T extends Pick<TeamMatchForPerformance, 'status' | 'homeScore' | 'awayScore'>>(m: T): m is T & { homeScore: number; awayScore: number } =>
  m.status === 'COMPLETED' && m.homeScore != null && m.awayScore != null && !(m.homeScore === 0 && m.awayScore === 0);

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
    if (!hasFinalScore(m)) continue;
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

export interface TeamSummary {
  played: number;
  wins: number;
  losses: number;
  /** 0–100, one decimal; null before a first game. */
  winPct: number | null;
  home: { w: number; l: number };
  away: { w: number; l: number };
  /** The run of the same result ending at the latest game, e.g. 3 wins. Null before a first game, or on a tie. */
  streak: { kind: 'W' | 'L'; count: number } | null;
  /** Points for and against per game; null before a first game. */
  ppg: number | null;
  papg: number | null;
}

/** A team's record across every tournament, from its own finished games. */
export function teamSummary(matches: TeamMatchForPerformance[]): TeamSummary {
  const played = matches.filter(hasFinalScore).sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''));
  const out: TeamSummary = { played: played.length, wins: 0, losses: 0, winPct: null, home: { w: 0, l: 0 }, away: { w: 0, l: 0 }, streak: null, ppg: null, papg: null };
  let pf = 0;
  let pa = 0;
  const results: Array<'W' | 'L' | 'T'> = [];
  for (const m of played) {
    const [f, a] = m.isHome ? [m.homeScore as number, m.awayScore as number] : [m.awayScore as number, m.homeScore as number];
    pf += f;
    pa += a;
    const side = m.isHome ? out.home : out.away;
    if (f > a) { out.wins += 1; side.w += 1; results.push('W'); }
    else if (a > f) { out.losses += 1; side.l += 1; results.push('L'); }
    else results.push('T');
  }
  if (played.length > 0) {
    out.winPct = Math.round((out.wins / played.length) * 1000) / 10;
    out.ppg = Math.round((pf / played.length) * 10) / 10;
    out.papg = Math.round((pa / played.length) * 10) / 10;
    const last = results[results.length - 1];
    if (last !== 'T') {
      let count = 0;
      for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count += 1;
      out.streak = { kind: last, count };
    }
  }
  return out;
}
