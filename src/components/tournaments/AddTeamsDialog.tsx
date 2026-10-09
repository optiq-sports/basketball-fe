import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useTeams, useTournamentAddTeams } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { GROUP_OPTIONS } from './TournamentTeamsPanel';
import { normalizeName } from '../../lib/text';

/**
 * Pick existing teams to add to a tournament. Teams already in it are left out, so nothing can be added
 * twice. Choosing a group sends it with the teams; leaving it blank leaves them ungrouped.
 */
const AddTeamsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  existingTeamIds: Set<string>;
}> = ({ open, onClose, tournamentId, existingTeamIds }) => {
  const teamsQuery = useTeams();
  const addTeams = useTournamentAddTeams();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [group, setGroup] = useState<'' | (typeof GROUP_OPTIONS)[number]>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (teamsQuery.data ?? [])
      .filter((t) => !existingTeamIds.has(t.id))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || (t.code ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teamsQuery.data, existingTeamIds, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    if (addTeams.isPending) return;
    setSelected(new Set());
    setGroup('');
    setSearch('');
    setError(null);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) {
      setError('Choose at least one team.');
      return;
    }
    setError(null);
    addTeams.mutate(
      { tournamentId, body: { teamIds: [...selected], ...(group ? { group } : {}) } },
      {
        onSuccess: () => {
          toast.success(`${selected.size} ${selected.size === 1 ? 'team' : 'teams'} added.`);
          setSelected(new Set());
          setGroup('');
          setSearch('');
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <Modal open={open} onClose={close} title="Add teams" size="md" closeOnBackdropClick={!addTeams.isPending} closeOnEscape={!addTeams.isPending}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate aria-busy={addTeams.isPending}>
        {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor="team-search" className="sr-only">Search teams</label>
            <input id="team-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div>
            <label htmlFor="add-group" className="sr-only">Group for the new teams</label>
            <select id="add-group" value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option value="">No group</option>
              {GROUP_OPTIONS.map((g) => <option key={g} value={g}>Group {g}</option>)}
            </select>
          </div>
        </div>

        {teamsQuery.isPending && <p className="text-sm text-gray-500">Loading teams…</p>}
        {teamsQuery.isError && <p className="text-sm text-rose-600">{(teamsQuery.error as Error).message}</p>}
        {!teamsQuery.isPending && !teamsQuery.isError && candidates.length === 0 && (
          <p className="text-sm text-gray-500">{search ? 'No teams match that search.' : 'Every team is already in this tournament.'}</p>
        )}

        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {candidates.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="size-4 rounded border-gray-300 text-court-600 focus:ring-court-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{normalizeName(t.name)}</span>
                {t.code && <span className="text-xs text-gray-500">{t.code}</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={close} disabled={addTeams.isPending}>Cancel</Button>
            <Button type="submit" disabled={addTeams.isPending || selected.size === 0}>
              {addTeams.isPending && <Spinner />}
              {addTeams.isPending ? 'Adding…' : 'Add to tournament'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AddTeamsDialog;
