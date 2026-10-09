import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useTeam } from '../../api/hooks';

export interface DeleteTeamTarget {
  id: string;
  name: string;
}

/**
 * Deleting a team cascades further than it looks: every match it has played, home or away, in any
 * tournament, is deleted with it — not just its tournament link (confirmed in the backend schema,
 * `onDelete: Cascade` from Match to Team). The list doesn't carry those counts, so this fetches the
 * team's own detail when it opens, and won't let the admin confirm until the real counts are in.
 */
const DeleteTeamDialog: React.FC<{
  target: DeleteTeamTarget | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isDeleting, onCancel, onConfirm }) => {
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [target?.id]);

  const detailQuery = useTeam(target?.id, !!target);
  const detail = detailQuery.data as { tournamentTeams?: unknown[]; homeMatches?: unknown[]; awayMatches?: unknown[] } | undefined;
  const ready = !!detail;
  const tournaments = detail?.tournamentTeams?.length ?? 0;
  const matches = (detail?.homeMatches?.length ?? 0) + (detail?.awayMatches?.length ?? 0);

  const canConfirm = !!target && ready && typed === target.name && !isDeleting;

  return (
    <Modal open={!!target} onClose={onCancel} title="Delete team?" size="sm" closeOnBackdropClick={!isDeleting} closeOnEscape={!isDeleting}>
      {target && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (canConfirm) onConfirm(); }}>
          {!ready && !detailQuery.isError && (
            <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Spinner className="size-4" /> Checking what this removes…
            </p>
          )}
          {detailQuery.isError && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              Couldn’t check what this removes: {(detailQuery.error as Error).message}
            </p>
          )}
          {ready && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This permanently deletes <strong>{target.name}</strong>, removes it from <strong>{tournaments}</strong> {tournaments === 1 ? 'tournament' : 'tournaments'}, and deletes <strong>{matches}</strong> {matches === 1 ? 'match' : 'matches'} it has played — home or away, in any tournament — with their recorded scores and events. This can’t be undone.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-team" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type <span className="font-semibold">{target.name}</span> to confirm
            </label>
            <input
              id="confirm-team"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              disabled={!ready}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" type="submit" disabled={!canConfirm}>
              {isDeleting && <Spinner />}
              {isDeleting ? 'Deleting…' : 'Delete team'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DeleteTeamDialog;
