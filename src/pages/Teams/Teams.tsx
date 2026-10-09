import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreateTeam, useDeleteTeam, useTeamsPage, useUpdateTeam } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Team, TeamCreate } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { Button } from '../../components/ui/primitives/button';
import { TeamCard, TEAM_GRID } from '../../components/teams/TeamCard';
import TeamFormDialog from '../../components/teams/TeamFormDialog';
import DeleteTeamDialog, { type DeleteTeamTarget } from '../../components/teams/DeleteTeamDialog';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 12;
const SORTS = { name: 'name', code: 'code', createdAt: 'createdAt' } as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;
const SORT_LABELS: Record<SortKey, string> = { name: 'Name', code: 'Code', createdAt: 'Newest' };

/**
 * Every team, one page at a time from the server. Search and sort are in the URL. Teams are cards, not a
 * table: each one is a crest, a name, a coach and a roster size — summary-shaped, not tabular.
 */
const Teams: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'name';
  const dir: 'asc' | 'desc' = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const q = params.get('q') ?? '';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => setParam({ q: draft.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const query = useTeamsPage({ search: q || undefined, sortBy: SORTS[sort], sortOrder: dir, page, limit: PAGE_SIZE });
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTeamTarget | null>(null);

  const rows: Team[] = query.data?.items ?? [];
  const meta = query.data?.meta;
  const hasFilter = q.length > 0;

  const openCreate = () => { setEditing(null); setFormError(null); setFormOpen(true); };
  const openEdit = (t: Team) => { setEditing(t); setFormError(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const saveForm = (body: TeamCreate) => {
    setFormError(null);
    if (editing) {
      updateTeam.mutate(
        { id: editing.id, data: body },
        { onSuccess: () => { toast.success(`${body.name} saved.`); closeForm(); }, onError: (err) => setFormError(err.message) },
      );
    } else {
      createTeam.mutate(body, {
        onSuccess: (created) => { toast.success(`${created.name} created.`); closeForm(); },
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

  const showEmpty = !query.isPending && !query.isError && rows.length === 0 && !hasFilter;
  const showNoResults = !query.isPending && !query.isError && rows.length === 0 && hasFilter;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teams" description="Every team across your tournaments." actions={<Button onClick={openCreate}>New team</Button>} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:max-w-sm">
          <label htmlFor="team-search" className="sr-only">Search teams by name</label>
          <input
            id="team-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div role="group" aria-label="Sort by" className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(SORTS) as SortKey[]).map((key) => {
            const active = sort === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setParam({ sort: key, dir: active && dir === 'asc' ? 'desc' : 'asc', page: null })}
                aria-label={`Sort by ${SORT_LABELS[key]}${active ? `, ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                className={cn('h-9 rounded-md px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', active ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800')}
              >
                {SORT_LABELS[key]}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {query.isPending && (
        <div role="status" aria-label="Loading teams" className={TEAM_GRID}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />)}
        </div>
      )}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {showEmpty && <EmptyState title="No teams yet" description="Create your first team to add it to a tournament." action={{ label: 'New team', onClick: openCreate }} />}
      {showNoResults && <NoResultsState query={q} onClear={() => setParams(new URLSearchParams(), { replace: true })} />}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          <ul className={cn(TEAM_GRID, query.isFetching && 'opacity-70 transition-opacity')} aria-label="Teams">
            {rows.map((t) => (
              <li key={t.id} className="min-w-0">
                <TeamCard team={t} onEdit={() => openEdit(t)} onDelete={() => setDeleteTarget({ id: t.id, name: normalizeName(t.name) })} />
              </li>
            ))}
          </ul>
          {meta && meta.pageCount > 1 && (
            <Pagination currentPage={meta.page} totalPages={meta.pageCount} totalItems={meta.itemCount} pageSize={PAGE_SIZE} onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })} />
          )}
        </>
      )}

      <TeamFormDialog open={formOpen} onClose={closeForm} initial={editing} isSaving={createTeam.isPending || updateTeam.isPending} serverError={formError} onSubmit={saveForm} />
      <DeleteTeamDialog target={deleteTarget} isDeleting={deleteTeam.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default Teams;
