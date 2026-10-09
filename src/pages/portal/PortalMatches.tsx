import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMatchesPage } from '../../api/hooks';
import type { Match } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { MatchCard, MATCH_GRID } from '../../components/matches/MatchCard';
import { cn } from '../../lib/utils';
import { MATCH_FILTERS, parseMatchFilter, parsePage } from './portal-format';

const PAGE_SIZE = 10;

/**
 * The client's matches as cards: the teams and scores, when and where. Filter and page live in the URL, so
 * a refresh or a shared link keeps the view. There's no search box: the backend ignores `search` on matches
 * (see docs/BACKEND_GAPS.md, Gap #33), and a control that does nothing isn't shipped.
 */
const PortalMatches: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const status = parseMatchFilter(params.get('status'));
  const page = parsePage(params.get('page'));

  const query = useMatchesPage({ status: status === 'all' ? undefined : status, page, limit: PAGE_SIZE });

  const setFilter = (next: typeof status) => {
    const p = new URLSearchParams(params);
    if (next === 'all') p.delete('status');
    else p.set('status', next);
    p.delete('page');
    setParams(p, { replace: true });
  };
  const setPage = (next: number) => {
    const p = new URLSearchParams(params);
    if (next <= 1) p.delete('page');
    else p.set('page', String(next));
    setParams(p);
  };

  const rows: Match[] = query.data?.items ?? [];
  const meta = query.data?.meta;
  const showEmpty = !query.isPending && !query.isError && rows.length === 0;
  const filtered = status !== 'all';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Matches" description="Every match your organisation runs, with live and final scores." />

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {MATCH_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'h-9 rounded-md px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-court-400/50',
              status === f.value ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isPending && (
        <div role="status" aria-label="Loading matches" className={MATCH_GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      )}

      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}

      {showEmpty && filtered && <NoResultsState onClear={() => setFilter('all')} />}
      {showEmpty && !filtered && <EmptyState title="No matches yet" description="Matches appear here once your organisation schedules them." />}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          <ul className={cn(MATCH_GRID, query.isFetching && 'opacity-70 transition-opacity')} aria-label="Matches">
            {rows.map((m) => (
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
                  href={`/portal/matches/${m.id}`}
                />
              </li>
            ))}
          </ul>
          {meta && meta.pageCount > 1 && (
            <Pagination currentPage={meta.page} totalPages={meta.pageCount} totalItems={meta.itemCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
};

export default PortalMatches;
