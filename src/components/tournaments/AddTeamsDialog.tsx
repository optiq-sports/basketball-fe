import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { btnPrimary, btnSecondary, errorBanner, inputClass, selectClass } from '../ui/formStyles';
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
    <Modal open={open} onClose={close} title="Add teams to tournament" size="md" closeOnBackdropClick={!addTeams.isPending} closeOnEscape={!addTeams.isPending}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate aria-busy={addTeams.isPending}>
        {error && <p role="alert" className={errorBanner}>{error}</p>}

        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor="team-search" className="sr-only">Search teams</label>
            <input id="team-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code" className={inputClass} />
          </div>
          <div>
            <label htmlFor="add-group" className="sr-only">Group for the new teams</label>
            <select id="add-group" value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className={selectClass}>
              <option value="">No group</option>
              {GROUP_OPTIONS.map((g) => <option key={g} value={g}>Group {g}</option>)}
            </select>
          </div>
        </div>

        {teamsQuery.isPending && <p className="text-sm text-gray-500 dark:text-gray-400">Loading teams...</p>}
        {teamsQuery.isError && <p className="text-sm text-error-600 dark:text-error-500">{(teamsQuery.error as Error).message}</p>}
        {!teamsQuery.isPending && !teamsQuery.isError && candidates.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {search
              ? 'No teams match that search.'
              : (teamsQuery.data ?? []).length === 0
                ? 'No teams available. Create teams first from Teams Management.'
                : 'Every team is already in this tournament.'}
          </p>
        )}

        <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {candidates.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="size-4 cursor-pointer rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-700" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{normalizeName(t.name)}</span>
                {t.code && <span className="text-xs text-gray-500 dark:text-gray-400">{t.code}</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">{selected.size} selected</span>
          <div className="flex gap-3">
            <button type="button" className={btnSecondary} onClick={close} disabled={addTeams.isPending}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={addTeams.isPending || selected.size === 0}>
              {addTeams.isPending && <Spinner />}
              {addTeams.isPending ? 'Adding...' : 'Add Teams'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AddTeamsDialog;
