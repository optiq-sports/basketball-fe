import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCreateMatch, useDeleteMatch, useMatchesPage, useStatisticians, useTournament, useUpdateMatch } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Match, MatchCreate } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { Button } from '../../components/ui/primitives/button';
import { MatchCard, MATCH_GRID } from '../../components/matches/MatchCard';
import { CopyMatchCodeButton } from '../../components/matches/CopyMatchCodeButton';
import { matchCodeOf } from '../../lib/match-code';
import FixtureFormDialog, { type FixtureStatistician, type FixtureTeam } from '../../components/fixtures/FixtureFormDialog';
import DeleteFixtureDialog, { type FixtureDeleteTarget } from '../../components/fixtures/DeleteFixtureDialog';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 10;
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'POSTPONED', label: 'Postponed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type MatchRow = Match & { statistician?: { name?: string | null; email?: string } | null; homeTeam?: { name: string } | null; awayTeam?: { name: string } | null };

const statisticianLabel = (m: MatchRow) => (m.statistician ? m.statistician.name || m.statistician.email || 'Assigned' : 'Unassigned');
/** Unassigned is flagged in amber, since a game with no statistician can't be scored. */
const statisticianFooter = (m: MatchRow) => (
  <span className={m.statistician ? undefined : 'font-semibold text-amber-700 dark:text-amber-300'}>{statisticianLabel(m)}</span>
);

/**
 * A tournament's fixtures, one page at a time, filtered by status (in the URL). Scheduling, rescheduling,
 * cancelling and assigning a statistician happen here. The scorer sets live and completed games, so this
 * page doesn't set them.
 */
const Fixtures: React.FC = () => {
  const { id: tournamentId } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const statusParam = params.get('status');
  const status = FILTERS.some((f) => f.value === statusParam) ? (statusParam as string) : 'all';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const tournamentQuery = useTournament(tournamentId);
  const statisticiansQuery = useStatisticians();
  const matchesQuery = useMatchesPage({ tournamentId, status: status === 'all' ? undefined : status, page, limit: PAGE_SIZE });
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FixtureDeleteTarget | null>(null);

  const teams: FixtureTeam[] = useMemo(() => {
    const linked = ((tournamentQuery.data as { teams?: Array<{ team: { id: string; name: string } }> } | undefined)?.teams ?? []);
    return linked.map((lt) => ({ id: lt.team.id, name: normalizeName(lt.team.name) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tournamentQuery.data]);
  const statisticians: FixtureStatistician[] = (statisticiansQuery.data ?? []) as FixtureStatistician[];
  const rows = (matchesQuery.data?.items ?? []) as MatchRow[];
  const meta = matchesQuery.data?.meta;
  const tournamentName = (tournamentQuery.data as { name?: string } | undefined)?.name ?? 'Tournament';
  const canCreate = teams.length >= 2;

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const labelOf = (m: MatchRow) => `${normalizeName(m.homeTeam?.name) || teamName(m.homeTeamId)} vs ${normalizeName(m.awayTeam?.name) || teamName(m.awayTeamId)}`;
  const teamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? 'TBD';

  const save = (body: { create?: MatchCreate; update?: Record<string, unknown> }) => {
    setFormError(null);
    if (body.create) {
      createMatch.mutate(body.create, {
        onSuccess: () => {
          toast.success('Fixture created.');
          setFormOpen(false);
        },
        onError: (err) => setFormError(err.message),
      });
    } else if (editing) {
      updateMatch.mutate(
        { id: editing.id, data: body.update as Record<string, unknown> & object },
        {
          onSuccess: () => {
            toast.success('Fixture saved.');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (err) => setFormError(err.message),
        },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMatch.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.label} deleted.`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(`Couldn’t delete ${target.label}: ${err.message}`);
        setDeleteTarget(null);
      },
    });
  };

  const teamLabel = labelOf;
  const openEdit = (m: MatchRow) => {
    setEditing(m);
    setFormError(null);
    setFormOpen(true);
  };
  const openDelete = (m: MatchRow) =>
    setDeleteTarget({ id: m.id, label: labelOf(m), hasGameData: m.status === 'LIVE' || m.status === 'COMPLETED' });
  const filtered = status !== 'all';
  const showEmpty = !matchesQuery.isPending && !matchesQuery.isError && rows.length === 0 && !filtered;
  const showNoResults = !matchesQuery.isPending && !matchesQuery.isError && rows.length === 0 && filtered;

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/tournaments/${tournamentId}`} className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← {tournamentName}</Link>

      <PageHeader
        title="Fixtures"
        description="Schedule games, set their time and venue, and assign a statistician."
        actions={<Button onClick={() => { setEditing(null); setFormError(null); setFormOpen(true); }} disabled={!canCreate}>New fixture</Button>}
      />

      {!tournamentQuery.isPending && !canCreate && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          A fixture needs two teams in the tournament. <Link to={`/tournaments/${tournamentId}?tab=teams`} className="font-semibold underline">Add teams first.</Link>
        </p>
      )}

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParam({ status: f.value === 'all' ? null : f.value, page: null })}
            className={cn('h-9 rounded-md px-3.5 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', status === f.value ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {matchesQuery.isPending && <ListSkeleton columns={6} rows={PAGE_SIZE} label="Loading fixtures" />}
      {matchesQuery.isError && <ErrorState message={(matchesQuery.error as Error).message} onRetry={() => void matchesQuery.refetch()} />}
      {showEmpty && <EmptyState title="No fixtures yet" description="Schedule the first game between two teams in this tournament." action={canCreate ? { label: 'New fixture', onClick: () => setFormOpen(true) } : undefined} />}
      {showNoResults && <NoResultsState onClear={() => setParam({ status: null, page: null })} />}

      {!matchesQuery.isPending && !matchesQuery.isError && rows.length > 0 && (
        <>
          <ul className={cn(MATCH_GRID, matchesQuery.isFetching && 'opacity-70 transition-opacity')} aria-label="Fixtures">
            {rows.map((m) => (
              <li key={m.id} className="min-w-0">
                <MatchCard
                  match={{
                    id: m.id,
                    home: { name: m.homeTeam?.name ?? 'TBD', code: m.homeTeam?.code, logo: m.homeTeam?.logo, color: m.homeTeam?.color },
                    away: { name: m.awayTeam?.name ?? 'TBD', code: m.awayTeam?.code, logo: m.awayTeam?.logo, color: m.awayTeam?.color },
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    status: m.status,
                    scheduledDate: m.scheduledDate,
                    venue: m.venue,
                    footer: statisticianFooter(m),
                  }}
                  href={`/tournaments/${tournamentId}/match/${m.id}`}
                  actions={
                    <>
                      <CopyMatchCodeButton code={matchCodeOf(m)} label={teamLabel(m)} />
                      <Button variant="secondary" size="sm" aria-label={`Edit ${teamLabel(m)}`} onClick={() => openEdit(m)}>Edit</Button>
                      <Button variant="destructive-ghost" size="sm" aria-label={`Delete ${teamLabel(m)}`} onClick={() => openDelete(m)}>Delete</Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
          {meta && meta.pageCount > 1 && (
            <Pagination currentPage={meta.page} totalPages={meta.pageCount} totalItems={meta.itemCount} pageSize={PAGE_SIZE} onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })} />
          )}
        </>
      )}

      <FixtureFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        match={editing}
        teams={teams}
        statisticians={statisticians}
        isSaving={createMatch.isPending || updateMatch.isPending}
        serverError={formError}
        onSubmit={save}
        tournamentId={tournamentId ?? ''}
      />
      <DeleteFixtureDialog target={deleteTarget} isDeleting={deleteMatch.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default Fixtures;
