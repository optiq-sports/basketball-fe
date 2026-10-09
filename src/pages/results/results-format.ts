import type { Match } from '../../types/api';

export interface DayGroup {
  /** `YYYY-MM-DD` in the viewer's time zone, so a game at 11pm stays on the day it was played. */
  day: string;
  label: string;
  matches: Match[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Groups one page of results under a heading per day, newest day first, keeping each day's games in the
 * order they arrived. The server already sorts newest first, so this only decides where the headings go.
 * A match with no usable date goes in its own group at the end rather than being dropped.
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
  return [...groups.values()].sort((a, b) => (a.day === 'unknown' ? 1 : b.day === 'unknown' ? -1 : b.day.localeCompare(a.day)));
}
