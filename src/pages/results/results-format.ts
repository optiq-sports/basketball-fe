import type { Match } from '../../types/api';

export interface DayGroup {
  /** `YYYY-MM-DD` in the viewer's time zone, so a game at 11pm stays on the day it was played. */
  day: string;
  label: string;
  matches: Match[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Groups results under a heading per day, newest day first, and newest game first within a day. A match
 * with no usable date goes in its own group at the end rather than being dropped.
 */
export function groupByDay(matches: Match[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const m of matches) {
    const d = new Date(m.scheduledDate);
    const valid = !Number.isNaN(d.getTime());
    const day = valid ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : 'unknown';
    const label = valid ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date not set';
    const group = groups.get(day) ?? { day, label, matches: [] };
    group.matches.push(m);
    groups.set(day, group);
  }
  for (const g of groups.values()) g.matches.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  return [...groups.values()].sort((a, b) => (a.day === 'unknown' ? 1 : b.day === 'unknown' ? -1 : b.day.localeCompare(a.day)));
}

/**
 * Finds games by team, venue or tournament name — the search the pre-redesign Results page had, before
 * switching to a server-paged list (which has to drop it, since the backend accepts `search` on matches
 * and ignores it: Gap 33) lost it. Restored client-side over the full list at the product lead's request
 * (Fix 126), the same way `Statisticians` already searches its full list for the same reason (Gap 39).
 */
export function searchMatches(matches: Match[], query: string): Match[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return matches;
  return matches.filter((m) =>
    [m.homeTeam?.name, m.awayTeam?.name, m.venue, m.tournament?.name].some((f) => (f ?? '').toLowerCase().includes(needle)),
  );
}

/** Games played on one calendar day (`YYYY-MM-DD`, in the viewer's time zone). No date means every game. */
export function filterByDate(matches: Match[], date: string): Match[] {
  if (!date) return matches;
  return matches.filter((m) => {
    const d = new Date(m.scheduledDate);
    return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === date;
  });
}
