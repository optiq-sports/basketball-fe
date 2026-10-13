import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMatches, useTournaments } from '../../api/hooks';
import type { Match } from '../../types/api';
import { PageHeader, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { MatchCard, MATCH_GRID } from '../../components/matches/MatchCard';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';
import { filterByDate, groupByDay, searchMatches } from './results-format';

const PAGE_SIZE = 12;

const selectClass =
  'h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

/**
 * Finished games, newest first, under a heading for each day, with search, a date and a tournament filter — the
 * pre-redesign experience, restored at the product lead's request (Fix 126). Search runs over the full
 * list in the browser rather than on the server, because the backend accepts `search` on matches and
 * ignores it (Gap 33); the same approach `Statisticians` already uses for the same reason. Scores are
 * `homeScore` and `awayScore`; this page used to read `totalHome` and `totalAway`, which the backend
 * never sends.
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
  const filtered = useMemo(() => filterByDate(searchMatches(all, q), date), [all, q, date]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const groups = groupByDay(rows);
  // A tournament filter is applied server-side (it's a new query), so an empty `all` can mean either
  // "nothing has finished yet" or "nothing has finished in the tournament you picked" — the second
  // needs a way back, not the plain empty state.
  const hasFilter = !!tournamentId || !!q || !!date;
  const showEmpty = !query.isPending && !query.isError && all.length === 0 && !hasFilter;
  const showNoResults = !query.isPending && !query.isError && filtered.length === 0 && hasFilter;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results" description="Games that have finished, newest first. Open one for the box score and shot chart." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:max-w-sm">
          <label htmlFor="results-search" className="sr-only">Search by team, venue or tournament</label>
          <input
            id="results-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by team, venue or tournament"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <label htmlFor="results-date" className="sr-only">Filter by date</label>
        <input
          id="results-date"
          type="date"
          className={selectClass}
          value={date}
          onChange={(e) => setParam({ date: e.target.value || null, page: null })}
        />
        <label htmlFor="results-tournament" className="sr-only">Filter by tournament</label>
        <select
          id="results-tournament"
          className={selectClass}
          value={tournamentId}
          onChange={(e) => setParam({ tournament: e.target.value || null, page: null })}
        >
          <option value="">All tournaments</option>
          {(tournaments.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>{normalizeName(t.name)}</option>
          ))}
        </select>
      </div>

      {query.isPending && (
        <div role="status" aria-label="Loading results" className={MATCH_GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      )}

      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}

      {showEmpty && (
        <EmptyState title="No finished games yet" description="A game shows up here once the scorer has finished it." />
      )}
      {showNoResults && <NoResultsState query={q || undefined} onClear={() => { setDraft(''); setParams(new URLSearchParams(), { replace: true }); }} />}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          <div className={cn('flex flex-col gap-6', query.isFetching && 'opacity-70 transition-opacity')}>
            {groups.map((g) => (
              <section key={g.day} aria-labelledby={`day-${g.day}`} className="flex flex-col gap-3">
                <h2 id={`day-${g.day}`} className="text-sm font-semibold text-gray-700 dark:text-gray-300">{g.label}</h2>
                <ul className={MATCH_GRID} aria-label={g.label}>
                  {g.matches.map((m) => (
                    <li key={m.id} className="min-w-0">
                      <MatchCard
                        match={{
                          id: m.id,
                          home: { name: m.homeTeam?.name ?? 'Home', code: m.homeTeam?.code, logo: m.homeTeam?.logo, color: m.homeTeam?.color },
                          away: { name: m.awayTeam?.name ?? 'Away', code: m.awayTeam?.code, logo: m.awayTeam?.logo, color: m.awayTeam?.color },
                          homeScore: m.homeScore,
                          awayScore: m.awayScore,
                          status: m.status,
                          scheduledDate: m.scheduledDate,
                          venue: m.venue,
                          eyebrow: m.tournament?.name,
                        }}
                        // The match carries its own tournament; the old page sent every game to tournament 1.
                        href={`/tournaments/${m.tournamentId}/match/${m.id}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
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
        </>
      )}
    </div>
  );
};

export default Results;
