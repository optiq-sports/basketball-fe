import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { btnDanger, btnSecondary, labelClass } from '../ui/formStyles';

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
          <div>
            <label htmlFor="confirm-name" className={labelClass}>
              Type <span className="font-semibold">{target.name}</span> to confirm
            </label>
            <input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-error-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <button type="button" className={btnSecondary} onClick={onCancel} disabled={isDeleting}>Cancel</button>
            <button type="submit" className={btnDanger} disabled={!canConfirm}>
              {isDeleting && <Spinner />}
              {isDeleting ? 'Deleting...' : 'Delete tournament'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DeleteTournamentDialog;
