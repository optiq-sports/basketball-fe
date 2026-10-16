import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiChevronLeft, FiPlus } from 'react-icons/fi';
import {
  useCreateMatch,
  useDeleteMatch,
  useMatchesPage,
  useStatisticians,
  useTournament,
  useUpdateMatch,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useLivePoll } from '../../hooks/useLivePoll';
import type { Match, MatchCreate } from '../../types/api';
import Pagination from '../../components/ui/Pagination';
import { errorBanner } from '../../components/ui/formStyles';
import { FixtureCard, FIXTURE_GRID, type FixtureStatus } from '../../components/fixtures/FixtureCard';
import FixtureFormDialog, { type FixtureStatistician, type FixtureTeam } from '../../components/fixtures/FixtureFormDialog';
import DeleteFixtureDialog, { type FixtureDeleteTarget } from '../../components/fixtures/DeleteFixtureDialog';
import { matchCodeOf } from '../../lib/match-code';
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

type MatchRow = Match & {
  statistician?: { name?: string | null; email?: string } | null;
  homeTeam?: { name: string; code?: string; logo?: string | null; color?: string | null } | null;
  awayTeam?: { name: string; code?: string; logo?: string | null; color?: string | null } | null;
};

/**
 * A tournament's fixtures, back to the pre-redesign layout: the `‹ Tournament` link, the title with Add
 * Game beside it, a pill bar, and the game cards two to a row with their number, status, hover actions,
 * crest-and-score body and date/venue footer.
 *
 * **The old page's three filters were all decoration.** Format (Round Robin / Knockout / League) and
 * Round (Group stage / Quarter Finals / …) were plain `useState` that nothing ever read — no request
 * carried them and no list used them. The Group A/B/C/D tabs were the same: `activeGroup` was set and
 * never referenced. So the pill bar is back, filtering by **match status**, which the backend does
 * support (`GET /matches?status=`), and the choice lives in the URL.
 *
 * Match stage and tournament format are real columns in the Prisma schema now but have no migration
 * (Gap 54), so there is still nothing to filter a round by. When the columns exist, a Round filter can
 * come back meaning something.
 *
 * **Kept from the redesign:** server-side paging, assigning a statistician when scheduling (the old Add
 * Game modal had no such field, so a game could be created that nobody could score), the delete
 * confirmation that warns when a game already has recorded data, polling while a game is live
 * (Fix 125), and `matchCodeOf` for the copy-code button.
 */
const Fixtures: React.FC = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const statusParam = params.get('status');
  const status = FILTERS.some((f) => f.value === statusParam) ? (statusParam as string) : 'all';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const tournamentQuery = useTournament(tournamentId);
  const statisticiansQuery = useStatisticians();
  const matchesQuery = useMatchesPage({ tournamentId, status: status === 'all' ? undefined : status, page, limit: PAGE_SIZE });
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();

  const [showAddGame, setShowAddGame] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FixtureDeleteTarget | null>(null);

  const teams: FixtureTeam[] = useMemo(() => {
    const linked = (tournamentQuery.data as { teams?: Array<{ team: { id: string; name: string } }> } | undefined)?.teams ?? [];
    return linked.map((lt) => ({ id: lt.team.id, name: normalizeName(lt.team.name) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tournamentQuery.data]);
  const statisticians: FixtureStatistician[] = (statisticiansQuery.data ?? []) as FixtureStatistician[];

  const rows = (matchesQuery.data?.items ?? []) as MatchRow[];
  const meta = matchesQuery.data?.meta;
  const tournamentName = normalizeName((tournamentQuery.data as { name?: string } | undefined)?.name) || 'Tournament';
  const canCreate = teams.length >= 2;
  useLivePoll(rows.some((m) => m.status === 'LIVE'), () => matchesQuery.refetch());

  const teamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? 'TBD';
  const sideOf = (m: MatchRow, which: 'home' | 'away') => {
    const team = which === 'home' ? m.homeTeam : m.awayTeam;
    return {
      name: team?.name ?? teamName(which === 'home' ? m.homeTeamId : m.awayTeamId),
      code: team?.code,
      logo: team?.logo,
      color: team?.color,
    };
  };
  const labelOf = (m: MatchRow) => `${normalizeName(sideOf(m, 'home').name)} vs ${normalizeName(sideOf(m, 'away').name)}`;

  const save = (body: { create?: MatchCreate; update?: Record<string, unknown> }) => {
    setFormError(null);
    if (body.create) {
      createMatch.mutate(body.create, {
        onSuccess: () => { toast.success('Fixture created.'); setShowAddGame(false); },
        onError: (err) => setFormError(err.message),
      });
    } else if (editing) {
      updateMatch.mutate(
        { id: editing.id, data: body.update as Record<string, unknown> & object },
        {
          onSuccess: () => { toast.success('Fixture saved.'); setEditing(null); },
          onError: (err) => setFormError(err.message),
        },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMatch.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.label} deleted.`); setDeleteTarget(null); },
      onError: (err) => { toast.error(`Couldn’t delete ${target.label}: ${err.message}`); setDeleteTarget(null); },
    });
  };

  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl text-error-600 dark:text-error-500">Missing tournament ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="mb-3 flex cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiChevronLeft aria-hidden className="size-4" />
          {tournamentName}
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fixtures</h1>
          <button
            type="button"
            onClick={() => { setEditing(null); setFormError(null); setShowAddGame(true); }}
            disabled={!canCreate}
            title={canCreate ? undefined : 'A fixture needs two teams in the tournament'}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus aria-hidden className="size-4" />
            Add Game
          </button>
        </div>

        {!tournamentQuery.isPending && !canCreate && (
          <p className="mb-6 rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500">
            A fixture needs two teams in the tournament.{' '}
            <Link to={`/tournaments/${tournamentId}`} className="font-semibold underline">Add teams first.</Link>
          </p>
        )}

        <div role="group" aria-label="Filter by status" className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => setParam({ status: f.value === 'all' ? null : f.value, page: null })}
              className={`cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                status === f.value
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {matchesQuery.isPending && <div className="py-4 text-gray-500 dark:text-gray-400">Loading fixtures...</div>}
        {matchesQuery.isError && (
          <div className={`mb-4 ${errorBanner}`}>{(matchesQuery.error as Error).message || 'Failed to load matches'}</div>
        )}

        {!matchesQuery.isPending && !matchesQuery.isError && rows.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status === 'all' ? 'No games scheduled yet.' : `No ${status.toLowerCase()} games.`}
            </p>
          </div>
        )}

        {!matchesQuery.isPending && !matchesQuery.isError && rows.length > 0 && (
          <>
            <div className={FIXTURE_GRID}>
              {rows.map((m, i) => (
                <FixtureCard
                  key={m.id}
                  tournamentId={tournamentId}
                  fixture={{
                    id: m.id,
                    number: ((meta?.page ?? page) - 1) * PAGE_SIZE + i + 1,
                    home: sideOf(m, 'home'),
                    away: sideOf(m, 'away'),
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    status: (m.status as FixtureStatus) ?? 'SCHEDULED',
                    scheduledDate: m.scheduledDate,
                    venue: m.venue,
                    matchCode: matchCodeOf(m),
                    statistician: m.statistician ? m.statistician.name || m.statistician.email || 'Assigned' : null,
                  }}
                  onEdit={() => { setEditing(m); setFormError(null); }}
                  onDelete={() =>
                    setDeleteTarget({ id: m.id, label: labelOf(m), hasGameData: m.status === 'LIVE' || m.status === 'COMPLETED' })
                  }
                />
              ))}
            </div>

            {meta && meta.pageCount > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={meta.page}
                  totalPages={meta.pageCount}
                  totalItems={meta.itemCount}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
                />
              </div>
            )}
          </>
        )}
      </div>

      <FixtureFormDialog
        open={showAddGame || !!editing}
        onClose={() => { setShowAddGame(false); setEditing(null); }}
        match={editing}
        teams={teams}
        statisticians={statisticians}
        isSaving={createMatch.isPending || updateMatch.isPending}
        serverError={formError}
        onSubmit={save}
        tournamentId={tournamentId}
      />
      <DeleteFixtureDialog
        target={deleteTarget}
        isDeleting={deleteMatch.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Fixtures;
