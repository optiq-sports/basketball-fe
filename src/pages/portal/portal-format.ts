import type { Match } from '../../types/api';
export { formatMatchDate, statusLabel, scoreLabel } from '../../lib/match-format';

export const MATCH_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
] as const;

export type MatchFilterValue = (typeof MATCH_FILTERS)[number]['value'];

export function parseMatchFilter(value: string | null): MatchFilterValue {
  return MATCH_FILTERS.some((f) => f.value === value) ? (value as MatchFilterValue) : 'all';
}

/** Page numbers from the URL. Anything that isn't a whole number ≥ 1 becomes page 1. */
export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Scores appear once a game has started. Before that, a dash. */
