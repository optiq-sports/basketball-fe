import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';

export interface DeleteTarget {
  id: string;
  name: string;
  matches: number;
  teams: number;
}

/**
 * Deleting a tournament removes its matches and everything recorded in them, and can't be undone. So
 * the admin must type the tournament's exact name before the button enables.
 */
const DeleteTournamentDialog: React.FC<{
  target: DeleteTarget | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isDeleting, onCancel, onConfirm }) => {
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [target?.id]);

  const matches = target?.matches ?? 0;
  const teams = target?.teams ?? 0;
  const canConfirm = !!target && typed === target.name && !isDeleting;

  return (
    <Modal open={!!target} onClose={onCancel} title="Delete tournament?" size="sm" closeOnBackdropClick={!isDeleting} closeOnEscape={!isDeleting}>
      {target && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onConfirm();
          }}
        >
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This permanently deletes <strong>{target.name}</strong>, its <strong>{matches}</strong> {matches === 1 ? 'match' : 'matches'} and every score recorded in them. {teams} {teams === 1 ? 'team is' : 'teams are'} unlinked from it. This can’t be undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type <span className="font-semibold">{target.name}</span> to confirm
            </label>
            <input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" type="submit" disabled={!canConfirm}>
              {isDeleting && <Spinner />}
              {isDeleting ? 'Deleting…' : 'Delete tournament'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DeleteTournamentDialog;
