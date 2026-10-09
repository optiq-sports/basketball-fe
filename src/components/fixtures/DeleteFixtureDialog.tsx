import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';

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
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (canConfirm) onConfirm(); }}>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            This permanently deletes <strong>{target.label}</strong>.
            {target.hasGameData ? ' It has recorded game data, which is removed with it.' : ''} This can’t be undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-fixture" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type <span className="font-semibold">{target.label}</span> to confirm
            </label>
            <input id="confirm-fixture" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" type="submit" disabled={!canConfirm}>
              {isDeleting && <Spinner />}
              {isDeleting ? 'Deleting…' : 'Delete fixture'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default DeleteFixtureDialog;
