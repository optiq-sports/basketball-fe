import type { Match } from '../types/api';

/**
 * The code a statistician types on the match-key screen to open a game. The backend looks a match up by
 * its `matchKey` or, failing that, by its id, and `matchKey` is a column nothing fills in, so for every
 * match today the code is simply its id. This is the one place that decides which to hand out.
 */
export function matchCodeOf(match: Pick<Match, 'id'> & { matchKey?: string | null }): string {
  return match.matchKey?.trim() || match.id;
}
