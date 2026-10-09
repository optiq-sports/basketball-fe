/**
 * Pure tournament maths: standings and stat leaders, computed from the matches that have been played.
 * Only COMPLETED matches count. A win is worth 2 points, as in the existing standings. Basketball has no
 * draws, so an exact tie counts as a game played with no winner.
 */

export interface StandingsTeam {
  id: string;
  name: string;
  group: string | null;
  color?: string | null;
}

export interface StandingsMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
}

export interface StandingRow extends StandingsTeam {
  gp: number;
  w: number;
  l: number;
  /** Win percentage, 0–100, one decimal. */
  pct: number;
  points: number;
}

export function computeStandings(teams: StandingsTeam[], matches: StandingsMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) rows.set(t.id, { ...t, gp: 0, w: 0, l: 0, pct: 0, points: 0 });

  for (const m of matches) {
    if (m.status !== 'COMPLETED' || m.homeScore == null || m.awayScore == null) continue;
    const home = rows.get(m.homeTeamId);
    const away = rows.get(m.awayTeamId);
    if (!home || !away) continue; // a team no longer in the tournament doesn't get a row
    home.gp += 1;
    away.gp += 1;
    if (m.homeScore > m.awayScore) {
      home.w += 1;
      away.l += 1;
    } else if (m.awayScore > m.homeScore) {
      away.w += 1;
      home.l += 1;
    }
  }

  const out = [...rows.values()].map((r) => ({
    ...r,
    pct: r.gp > 0 ? Math.round((r.w / r.gp) * 1000) / 10 : 0,
    points: r.w * 2,
  }));
  return out.sort((a, b) => b.points - a.points || b.pct - a.pct || a.name.localeCompare(b.name));
}

export const LEADER_STATS = ['points', 'rebounds', 'assists', 'blocks', 'steals'] as const;
export type LeaderStat = (typeof LEADER_STATS)[number];

export const LEADER_LABELS: Record<LeaderStat, string> = {
  points: 'Points',
  rebounds: 'Rebounds',
  assists: 'Assists',
  blocks: 'Blocks',
  steals: 'Steals',
};

export interface LeaderRow {
  playerId: string;
  name: string;
  teamName: string;
  gp: number;
  total: number;
  /** Per-game average, one decimal. */
  avg: number;
}

export interface MatchPlayerStat {
  playerId: string;
  points?: number;
  rebounds?: number;
  assists?: number;
  blocks?: number;
  steals?: number;
  player?: { firstName: string; lastName: string } | null;
}

export interface LeaderMatch {
  status: string;
  homeTeamId?: string;
  awayTeamId?: string;
  stats?: MatchPlayerStat[];
}

/**
 * Season totals per player across completed matches, ranked by one stat. Only players who appear in a
 * completed match's stats are counted, so an unplayed game can't inflate the averages.
 */
export function leadersFrom(matches: LeaderMatch[], stat: LeaderStat, teamNameById: Map<string, string>, limit = 5): LeaderRow[] {
  const totals = new Map<string, { name: string; teamName: string; gp: number; total: number }>();
  for (const m of matches) {
    if (m.status !== 'COMPLETED') continue;
    for (const s of m.stats ?? []) {
      const entry = totals.get(s.playerId) ?? {
        name: s.player ? `${s.player.firstName} ${s.player.lastName}`.trim() : 'Unknown player',
        teamName: '',
        gp: 0,
        total: 0,
      };
      entry.gp += 1;
      entry.total += s[stat] ?? 0;
      totals.set(s.playerId, entry);
    }
  }
  return [...totals.entries()]
    .map(([playerId, e]) => ({
      playerId,
      name: e.name,
      teamName: e.teamName,
      gp: e.gp,
      total: e.total,
      avg: e.gp > 0 ? Math.round((e.total / e.gp) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total || b.avg - a.avg || a.name.localeCompare(b.name))
    .slice(0, limit);
}
