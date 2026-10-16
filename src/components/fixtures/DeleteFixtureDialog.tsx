import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { btnDanger, btnSecondary, labelClass } from '../ui/formStyles';

export interface FixtureDeleteTarget {
  id: string;
  label: string; // "Home vs Away"
  hasGameData: boolean; // a live or completed game, or any recorded events
}

/**
 * Deleting a fixture also removes its game data, so the admin types the fixture's exact label first.
 * A fixture that has been played gets a sharper warning.
 */
const DeleteFixtureDialog: React.FC<{
  target: FixtureDeleteTarget | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isDeleting, onCancel, onConfirm }) => {
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [target?.id]);
  const canConfirm = !!target && typed === target.label && !isDeleting;

  return (
    <Modal open={!!target} onClose={onCancel} title="Delete fixture?" size="sm" closeOnBackdropClick={!isDeleting} closeOnEscape={!isDeleting}>
      {target && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (canConfirm) onConfirm(); }}>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This permanently deletes <strong>{target.label}</strong>.
            {target.hasGameData ? ' It has recorded game data, which is removed with it.' : ''} This can’t be undone.
          </p>
          <div>
            <label htmlFor="confirm-fixture" className={labelClass}>
              Type <span className="font-semibold">{target.label}</span> to confirm
            </label>
            <input id="confirm-fixture" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-error-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <button type="button" className={btnSecondary} onClick={onCancel} disabled={isDeleting}>Cancel</button>
            <button type="submit" className={btnDanger} disabled={!canConfirm}>
              {isDeleting && <Spinner />}
              {isDeleting ? 'Deleting...' : 'Delete fixture'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DeleteFixtureDialog;
