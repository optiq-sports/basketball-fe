import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { useCreateTeam, useDeleteTeam, useTeamsPage, useUpdateTeam } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Team, TeamCreate } from '../../types/api';
import Pagination from '../../components/ui/Pagination';
import { btnPrimaryLg, errorBanner } from '../../components/ui/formStyles';
import { TeamCard, TEAM_GRID } from '../../components/teams/TeamCard';
import { SortGroup, type SortOption } from '../../components/ui/SortGroup';
import TeamFormDialog from '../../components/teams/TeamFormDialog';
import DeleteTeamDialog, { type DeleteTeamTarget } from '../../components/teams/DeleteTeamDialog';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 9;

/**
 * Sort fields. Each has to be a real column on the team table — `TeamsService.findAll` hands `sortBy`
 * to Prisma untouched, so anything else answers 400.
 */
const SORTS = { name: 'name', code: 'code', createdAt: 'createdAt' } as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;
const SORT_OPTIONS: ReadonlyArray<SortOption<SortKey>> = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'createdAt', label: 'Newest' },
];
/** A name or a code reads A–Z; "Newest" means newest first. */
const defaultDir = (key: SortKey): 'asc' | 'desc' => (key === 'createdAt' ? 'desc' : 'asc');

/**
 * Every team, back to the pre-redesign layout: the full-bleed white panel, the large title, the `brand`
 * Add Team button beside a 250px search box with its inset magnifier, and the colour-banner cards three
 * to a row, nine to a page.
 *
 * **The server still does the paging, searching and sorting.** The old page pulled every team and
 * filtered in the browser. The sort buttons sit beside the search box and put the field and direction
 * in the URL, so a sorted list can be linked and survives a reload.
 *
 * One consequence, stated plainly rather than hidden: the server matches `search` against the team
 * **name** only (`searchFields: ["name"]`), while the old in-browser filter also matched the code,
 * country and state. The placeholder says name so nobody types a team code and concludes the team is
 * missing. Widening it is a one-line backend change — see Gap 58.
 *
 * **Delete still asks for the name.** `DELETE /teams/:id` cascades: every match the team has played,
 * home or away, in any tournament, goes with it. The old page's `confirm()` said only "This action
 * cannot be undone", which undersold it by a long way.
 */
const Teams: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'name';
  const dirParam = params.get('dir');
  const dir: 'asc' | 'desc' = dirParam === 'asc' || dirParam === 'desc' ? dirParam : defaultDir(sort);

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  // Typing stays local and reaches the server — and the URL — after a pause.
  const [searchQuery, setSearchQuery] = useState(params.get('q') ?? '');
  const search = useDebouncedValue(searchQuery.trim(), 300);
  const q = params.get('q') ?? '';
  useEffect(() => {
    if (search === q) return;
    setParam({ q: search || null, page: null });
    // `search` settling is the only trigger that matters; setParam reads the live params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = useTeamsPage({ search: search || undefined, sortBy: SORTS[sort], sortOrder: dir, page, limit: PAGE_SIZE });
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTeamTarget | null>(null);

  const teams: Team[] = query.data?.items ?? [];
  const meta = query.data?.meta;

  // Clicking the field already sorted on flips the direction; a new field starts at its own default.
  const handleSort = (key: SortKey) => {
    const next = key === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(key);
    setParam({ sort: key === 'name' ? null : key, dir: next === defaultDir(key) ? null : next, page: null });
  };

  const handleAddTeam = () => {
    setEditingTeam(null);
    setFormError(null);
    setIsModalOpen(true);
  };
  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setFormError(null);
    setIsModalOpen(true);
  };
  const closeForm = () => {
    setIsModalOpen(false);
    setEditingTeam(null);
  };

  const saveForm = (body: TeamCreate) => {
    setFormError(null);
    if (editingTeam) {
      updateTeam.mutate(
        { id: editingTeam.id, data: body },
        {
          onSuccess: () => { toast.success(`${normalizeName(body.name)} saved.`); closeForm(); },
          onError: (err) => setFormError(err.message),
        },
      );
    } else {
      createTeam.mutate(body, {
        onSuccess: (created) => { toast.success(`${normalizeName(created.name)} created.`); closeForm(); },
        onError: (err) => setFormError(err.message),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTeam.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.name} deleted.`); setDeleteTarget(null); },
      onError: (err) => { toast.error(`Couldn’t delete ${target.name}: ${err.message}`); setDeleteTarget(null); },
    });
  };

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Teams</h1>
      </div>

      {query.error && <div className={`mb-6 ${errorBanner}`}>{(query.error as Error).message}</div>}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleAddTeam} className={btnPrimaryLg}>
          Add Team
        </button>

        <div className="relative" style={{ width: '250px', minWidth: '200px' }}>
          <label htmlFor="team-search" className="sr-only">Search teams by name</label>
          <FiSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={20} />
          <input
            id="team-search"
            type="text"
            placeholder="Search team name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <SortGroup options={SORT_OPTIONS} active={sort} dir={dir} onSort={handleSort} />
      </div>

      {query.isPending ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading teams...</div>
      ) : (
        <>
          <div className={`mb-8 ${TEAM_GRID}`}>
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={() => handleEditTeam(team)}
                onDelete={() => setDeleteTarget({ id: team.id, name: normalizeName(team.name) })}
              />
            ))}
          </div>

          {teams.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500 dark:text-gray-400">No teams found</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                {q ? 'Try a different team name.' : 'Create your first team to add it to a tournament.'}
              </p>
            </div>
          )}

          <Pagination
            currentPage={meta?.page ?? page}
            totalPages={meta?.pageCount ?? 1}
            onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
            totalItems={meta?.itemCount ?? teams.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <TeamFormDialog
        open={isModalOpen}
        onClose={closeForm}
        initial={editingTeam}
        isSaving={createTeam.isPending || updateTeam.isPending}
        serverError={formError}
        onSubmit={saveForm}
      />
      <DeleteTeamDialog
        target={deleteTarget}
        isDeleting={deleteTeam.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Teams;
