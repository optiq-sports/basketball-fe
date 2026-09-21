export interface StatLine {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
}

/** `live` = polled projection of a game in progress; `saved` = the stored MatchStat record;
 * `projection` = projection used because nothing was saved for a game that isn't live. */
export type StatSource = 'live' | 'saved' | 'projection';

const hasAnyStat = (s: StatLine): boolean =>
  s.points + s.rebounds + s.assists + s.blocks + s.steals + s.fouls + s.turnovers > 0;

/**
 * Which numbers the player page should show.
 *
 * While a game is live the projection is fresher than the saved record (which is only synced
 * from it afterwards), so it wins. For a finished game the saved record is authoritative. If a
 * finished game has nothing saved, fall back to the projection — but only when it has something
 * to show: the backend answers with all zeros for a player who has no events, and "0 0 0 0" would
 * read as a recorded stat line for someone who never played.
 */
export function pickPlayerStats(input: {
  isLive: boolean;
  saved: StatLine | null | undefined;
  projection: StatLine | null | undefined;
}): { stats: StatLine; source: StatSource } | null {
  const { isLive, saved, projection } = input;
  if (isLive && projection) return { stats: projection, source: 'live' };
  if (saved) return { stats: saved, source: 'saved' };
  if (projection && hasAnyStat(projection)) return { stats: projection, source: 'projection' };
  return null;
}

/** A match can have several sessions; the one being played (or paused) is the one to follow. */
export function pickGameSessionId(
  sessions: Array<{ id: string; status: string }> | undefined,
): string | undefined {
  if (!sessions || sessions.length === 0) return undefined;
  const active = sessions.find((s) => s.status === 'IN_PROGRESS' || s.status === 'PAUSED');
  return (active ?? sessions[0]).id;
}
