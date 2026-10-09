import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';
import { formatMatchDate, statusLabel } from '../../lib/match-format';
import { TeamCrest } from '../teams/TeamCrest';

export interface MatchCardTeam {
  name: string;
  code?: string;
  logo?: string | null;
  color?: string | null;
}

export interface MatchCardData {
  id: string;
  home: MatchCardTeam;
  away: MatchCardTeam;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  scheduledDate: string;
  venue?: string | null;
  /** Shown in the header band, e.g. the tournament name. */
  eyebrow?: string | null;
  /** Shown below the teams, e.g. "Sam Scorer" or "Unassigned". */
  footer?: React.ReactNode;
}

/**
 * A match as a card: a filled header band for the competition and status, then the two teams with
 * their crests and scores. The header band is a solid rectangle, not a border — a coloured border or
 * accent bar on a rounded card either has to be rounded itself (fussy to get right) or it visibly
 * breaks the corner. A filled band inside `overflow-hidden` has neither problem: it's naturally
 * clipped to the card's own corner radius.
 *
 * The whole card opens the match through a stretched link; actions go in `actions`, above the link.
 */
export function MatchCard({ match, href, actions }: { match: MatchCardData; href: string; actions?: React.ReactNode }) {
  const live = match.status === 'LIVE';
  const started = match.status !== 'SCHEDULED' && match.homeScore != null && match.awayScore != null;
  const home = normalizeName(match.home.name);
  const away = normalizeName(match.away.name);
  const label = `${home} versus ${away}, ${statusLabel(match.status)}, ${formatMatchDate(match.scheduledDate)}`;

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className={cn('flex items-center justify-between gap-3 px-4 py-2', live ? 'bg-signal-500 text-white' : 'bg-gray-50 text-gray-600 dark:bg-gray-800/70 dark:text-gray-300')}>
        <span className="truncate text-xs font-semibold uppercase tracking-wide">{match.eyebrow ? normalizeName(match.eyebrow) : formatMatchDate(match.scheduledDate)}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
          {live && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" />}
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {match.eyebrow && <p className="text-xs text-gray-500 dark:text-gray-400">{formatMatchDate(match.scheduledDate)}</p>}
        <TeamLine team={match.home} name={home} score={started ? match.homeScore : undefined} winning={started && (match.homeScore ?? 0) > (match.awayScore ?? 0)} />
        <TeamLine team={match.away} name={away} score={started ? match.awayScore : undefined} winning={started && (match.awayScore ?? 0) > (match.homeScore ?? 0)} />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">{match.venue || 'Venue to be confirmed'}</span>
          {match.footer && <span className="min-w-0 truncate">{match.footer}</span>}
        </div>
      </div>

      <Link
        to={href}
        aria-label={label}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
      >
        <span className="sr-only">Open match</span>
      </Link>

      {actions && <div className="relative z-10 flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">{actions}</div>}
    </article>
  );
}

function TeamLine({ team, name, score, winning }: { team: MatchCardTeam; name: string; score?: number | null; winning: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <TeamCrest name={team.name} code={team.code} logo={team.logo} color={team.color} size="sm" />
      <span className={cn('min-w-0 flex-1 truncate text-base', winning ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200')}>{name}</span>
      <span className={cn('shrink-0 tabular-nums text-xl', winning ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-500 dark:text-gray-400')}>
        {score ?? '–'}
      </span>
    </div>
  );
}

/** Responsive grid for match cards: one column on phones, more as the screen widens. */
export const MATCH_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
