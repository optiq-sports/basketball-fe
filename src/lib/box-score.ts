import type { BoxScoreProjection } from '../services/statdash/types';
import type { Match } from '../types/api';
import type { BoxScoreRow } from '../components/client/BoxScoreTable';

/** Maps every rostered player id to their name and team side, from the match's two rosters. */
export function rosterOf(match: Match) {
  const names = new Map<string, { name: string; side: 'home' | 'away' }>();
  const add = (side: 'home' | 'away', team?: Match['homeTeam']) => {
    for (const pt of team?.playerTeams ?? []) {
      const id = pt.playerId ?? pt.player?.id;
      const p = pt.player;
      if (!id) continue;
      names.set(id, { name: p ? `${p.firstName} ${p.lastName}`.trim() : 'Player', side });
    }
  };
  add('home', match.homeTeam);
  add('away', match.awayTeam);
  return names;
}

/**
 * Splits the box score into the two teams using the rosters. A player on neither roster is counted, not
 * guessed at, so the page can say how many were left out.
 */
export function splitBoxScore(box: BoxScoreProjection, match: Match): { home: BoxScoreRow[]; away: BoxScoreRow[]; unassigned: number } {
  const roster = rosterOf(match);
  const home: BoxScoreRow[] = [];
  const away: BoxScoreRow[] = [];
  let unassigned = 0;
  for (const p of Object.values(box.players)) {
    const who = roster.get(p.playerId);
    const row = { ...p, name: who?.name ?? 'Unknown player' } as BoxScoreRow;
    if (!who) unassigned += 1;
    else if (who.side === 'home') home.push(row);
    else away.push(row);
  }
  const byName = (a: BoxScoreRow, b: BoxScoreRow) => a.name.localeCompare(b.name);
  return { home: home.sort(byName), away: away.sort(byName), unassigned };
}

/** Plain-words message for a failed read. A 403 means the account may not open this data. */
export function dataErrorMessage(error: unknown, subject: string): string {
  const status = (error as { status?: number })?.status;
  if (status === 403) return `Your account can’t open the ${subject} for this game.`;
  if (status === 404) return `The ${subject} for this game isn’t available.`;
  return error instanceof Error ? error.message : `Couldn’t load the ${subject}.`;
}
