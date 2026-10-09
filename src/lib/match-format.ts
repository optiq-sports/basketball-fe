import type { Match } from '../types/api';

export function formatMatchDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(status: string): string {
  return ({ SCHEDULED: 'Scheduled', LIVE: 'Live', COMPLETED: 'Final', CANCELLED: 'Cancelled', POSTPONED: 'Postponed' } as Record<string, string>)[status] ?? status;
}

export function scoreLabel(match: Pick<Match, 'status' | 'homeScore' | 'awayScore'>): string {
  if (match.status === 'SCHEDULED' || match.homeScore === undefined || match.awayScore === undefined) return '—';
  return `${match.homeScore} – ${match.awayScore}`;
}

