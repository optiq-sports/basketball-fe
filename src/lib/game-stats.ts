import type { BoxScoreRow } from '../components/client/BoxScoreTable';

export interface ShotLike {
  teamId: string | null;
  result: string | null;
  shotValue?: number | null;
}

export interface Shooting {
  fgm: number;
  fga: number;
  twoM: number;
  twoA: number;
  threeM: number;
  threeA: number;
}

/**
 * A team's field-goal line from its recorded shots. Counted from every shot event whether or not it has
 * a court location, so it matches the score. Free throws aren't in the shot feed (Gap 54), so there is
 * no FT line.
 */
export function teamShooting(shots: ShotLike[], teamId: string | undefined): Shooting {
  const out: Shooting = { fgm: 0, fga: 0, twoM: 0, twoA: 0, threeM: 0, threeA: 0 };
  if (!teamId) return out;
  for (const s of shots) {
    if (s.teamId !== teamId || (s.result !== 'made' && s.result !== 'missed')) continue;
    const made = s.result === 'made' ? 1 : 0;
    out.fga += 1;
    out.fgm += made;
    if (s.shotValue === 3) {
      out.threeA += 1;
      out.threeM += made;
    } else if (s.shotValue === 2) {
      out.twoA += 1;
      out.twoM += made;
    }
  }
  return out;
}

/** Percent to one decimal, or null when there were no attempts (shown as a dash, never 0%). */
export function pct(made: number, attempted: number): number | null {
  return attempted > 0 ? Math.round((made / attempted) * 1000) / 10 : null;
}

export interface TeamTotals {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export function teamTotals(rows: BoxScoreRow[]): TeamTotals {
  const t: TeamTotals = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0 };
  for (const r of rows) {
    t.points += r.points;
    t.rebounds += r.rebounds;
    t.assists += r.assists;
    t.steals += r.steals;
    t.blocks += r.blocks;
    t.turnovers += r.turnovers;
    t.fouls += r.fouls;
  }
  return t;
}

export type LeaderKey = 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks';

/** The player with the most of a stat, or null if nobody has any. Ties go to the first by name. */
export function leaderOf(rows: BoxScoreRow[], key: LeaderKey): BoxScoreRow | null {
  let best: BoxScoreRow | null = null;
  for (const r of rows) {
    if (r[key] <= 0) continue;
    if (!best || r[key] > best[key] || (r[key] === best[key] && r.name.localeCompare(best.name) < 0)) best = r;
  }
  return best;
}
