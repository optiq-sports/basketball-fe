import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiChevronDown, FiFilter, FiSearch } from 'react-icons/fi';
import { useMatches, useTournaments } from '../../api/hooks';
import type { Match } from '../../types/api';
import Pagination from '../../components/ui/Pagination';
import { errorBanner } from '../../components/ui/formStyles';
import { TeamCrest } from '../../components/teams/TeamCrest';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';
import { filterByDate, groupByDay, searchMatches } from './results-format';

const PAGE_SIZE = 12;

const filterSelectClass =
  'min-w-[180px] cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-8 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

const formatDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/** One finished game, as the pre-redesign row: both teams stacked on the left, venue and time right. */
function ResultRow({ match }: { match: Match }) {
  const home = normalizeName(match.homeTeam?.name) || 'Home';
  const away = normalizeName(match.awayTeam?.name) || 'Away';
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

  const side = (name: string, score: number, won: boolean, team?: Match['homeTeam']) => (
    <div className="flex items-center gap-3">
      <TeamCrest name={name} code={team?.code} logo={team?.logo} color={team?.color} />
      <span className={cn('w-32 truncate text-sm sm:w-40', won ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300')}>
        {name}
      </span>
      <span className={cn('text-sm tabular-nums', won ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-600 dark:text-gray-400')}>
        {score}
      </span>
    </div>
  );

  return (
    <Link
      to={`/tournaments/${match.tournamentId}/match/${match.id}`}
      aria-label={`${home} ${homeScore}, ${away} ${awayScore} — open the box score`}
      className="block cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-white/[0.02]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          {side(home, homeScore, homeWon, match.homeTeam)}
          {side(away, awayScore, awayWon, match.awayTeam)}
        </div>

        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          {match.tournament?.name && (
            <p className="font-medium text-gray-700 dark:text-gray-300">{normalizeName(match.tournament.name)}</p>
          )}
          <p>{match.venue || '—'}</p>
          <p>{formatDateTime(match.scheduledDate)}</p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Finished games, newest first, under a heading for each day — back to the pre-redesign layout: the
 * `max-w-6xl` page, the `text-3xl` title, the wide search box with its inset magnifier, the date filter
 * framed by its funnel and chevron, and the grey result rows with both teams stacked on the left.
 *
 * **Three things the old page got wrong are not restored:**
 *
 * 1. **Every score read `0`.** It took them from `match.totalHome` and `match.totalAway`, which the
 *    backend has never sent. The fields are `homeScore` and `awayScore`.
 * 2. **Every game linked to tournament 1.** `navigate(`/tournaments/1/match/${id}`)` was hardcoded, so
 *    opening a result from any other tournament landed on the wrong one. Each match carries its own
 *    `tournamentId`.
 * 3. **The crests were `/ball1.png` and `/ball2.png`** on hardcoded amber and blue tiles, so no team's
 *    logo or colour appeared. `TeamCrest` draws the real one.
 *
 * **The date filter is a select again**, as it was, but built from the days that actually have results
 * rather than parsed back out of `toLocaleDateString()` strings — the old version compared dates by
 * feeding localised text to `new Date()`, which is locale-dependent and silently wrong in most of them.
 *
 * Search runs over the full list in the browser: the backend accepts `search` on matches and ignores it
 * (Gap 33). The winner's name and score are emphasised, which the old row didn't do.
 */
const Results: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tournamentId = params.get('tournament') ?? '';
  const q = params.get('q') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : '';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const query = useMatches(tournamentId || undefined, 'COMPLETED');
  const tournaments = useTournaments();

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  // Search types locally and writes to the URL after a pause, so each keystroke doesn't refilter at once.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => setParam({ q: draft.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
    // setParam is stable enough for this debounce; q and draft are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const all: Match[] = useMemo(() => query.data ?? [], [query.data]);
  /** Only the days that have a result, newest first — the options the old date select should have had. */
  const dayOptions = useMemo(() => groupByDay(all).filter((g) => g.day !== 'unknown').map((g) => ({ value: g.day, label: g.label })), [all]);

  const filtered = useMemo(() => filterByDate(searchMatches(all, q), date), [all, q, date]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const groups = groupByDay(rows);

  const hasFilter = !!tournamentId || !!q || !!date;
  const isPending = query.isPending;

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="mb-6 text-3xl font-semibold text-gray-800 dark:text-white">Results</h1>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[16rem] flex-1">
              <label htmlFor="results-search" className="sr-only">Search by team, venue or tournament</label>
              <FiSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={20} />
              <input
                id="results-search"
                type="text"
                placeholder="Search by team, venue, or tournament"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
              />
            </div>

            <div className="relative">
              <label htmlFor="results-date" className="sr-only">Filter by date</label>
              <select
                id="results-date"
                className={filterSelectClass}
                value={date}
                onChange={(e) => setParam({ date: e.target.value || null, page: null })}
              >
                <option value="">All dates</option>
                {dayOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <FiFilter aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
              <FiChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
            </div>

            <div className="relative">
              <label htmlFor="results-tournament" className="sr-only">Filter by tournament</label>
              <select
                id="results-tournament"
                className={filterSelectClass}
                value={tournamentId}
                onChange={(e) => setParam({ tournament: e.target.value || null, page: null })}
              >
                <option value="">All tournaments</option>
                {(tournaments.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{normalizeName(t.name)}</option>
                ))}
              </select>
              <FiFilter aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
              <FiChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
            </div>
          </div>
        </div>

        {query.isError && (
          <div className={`mb-8 ${errorBanner}`}>
            {(query.error as Error).message || 'Failed to load results'}
          </div>
        )}

        <div className="mb-8 space-y-8">
          {isPending && <p className="text-sm text-gray-600 dark:text-gray-400">Loading completed games...</p>}

          {!isPending && !query.isError && rows.length > 0 && (
            <div className={cn('space-y-8', query.isFetching && 'opacity-70 transition-opacity')}>
              {groups.map((g) => (
                <section key={g.day} aria-labelledby={`day-${g.day}`}>
                  <h2 id={`day-${g.day}`} className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-200">{g.label}</h2>
                  <div className="space-y-4">
                    {g.matches.map((m) => <ResultRow key={m.id} match={m} />)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {!isPending && !query.isError && rows.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500 dark:text-gray-400">No results found</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                {hasFilter ? 'Try adjusting your search or filter criteria' : 'A game shows up here once the scorer has finished it.'}
              </p>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => { setDraft(''); setParams(new URLSearchParams(), { replace: true }); }}
                  className="mt-4 cursor-pointer text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {pageCount > 1 && (
          <Pagination
            currentPage={safePage}
            totalPages={pageCount}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
          />
        )}
      </div>
    </div>
  );
};

export default Results;
