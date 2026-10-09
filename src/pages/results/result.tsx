import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMatchesPage, useTournaments } from '../../api/hooks';
import type { Match } from '../../types/api';
import { PageHeader, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { MatchCard, MATCH_GRID } from '../../components/matches/MatchCard';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';
import { groupByDay } from './results-format';

const PAGE_SIZE = 12;

const selectClass =
  'h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

/**
 * Finished games, newest first, one server page at a time, under a heading for each day. The tournament
 * filter and the page live in the URL.
 *
 * There is no search box: the backend accepts `search` on matches and ignores it (Gap 33), and the page
 * is no longer the whole list fetched at once, so filtering the twelve on screen would be wrong for the
 * rest. Scores are `homeScore` and `awayScore`; this page used to read `totalHome` and `totalAway`,
 * which the backend never sends.
 */
const Results: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tournamentId = params.get('tournament') ?? '';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const query = useMatchesPage({
    status: 'COMPLETED',
    tournamentId: tournamentId || undefined,
    sortBy: 'scheduledDate',
    sortOrder: 'desc',
    page,
    limit: PAGE_SIZE,
  });
  const tournaments = useTournaments();

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const rows: Match[] = query.data?.items ?? [];
  const meta = query.data?.meta;
  const groups = groupByDay(rows);
  const showEmpty = !query.isPending && !query.isError && rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results" description="Games that have finished, newest first. Open one for the box score and shot chart." />

      <div className="flex flex-wrap items-center gap-3">
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

      {showEmpty && tournamentId && <NoResultsState onClear={() => setParam({ tournament: null, page: null })} />}
      {showEmpty && !tournamentId && (
        <EmptyState title="No finished games yet" description="A game shows up here once the scorer has finished it." />
      )}

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

          {meta && meta.pageCount > 1 && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.pageCount}
              totalItems={meta.itemCount}
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
