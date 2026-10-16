import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { PlayerPicker } from './PlayerPicker';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

const fullName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`;

/**
 * Merges a duplicate player profile into the one to keep. This is the only operation in the app that
 * really deletes a player row: the backend moves the duplicate's team assignments, match stats and
 * match rosters onto the target and then deletes the duplicate outright. Where both players are
 * already in the same team or match, the duplicate's record is dropped rather than moved.
 *
 * Because it can't be undone, the duplicate's name has to be typed before the button enables.
 */
const MergePlayersDialog: React.FC<{
  open: boolean;
  isMerging: boolean;
  serverError?: string | null;
  onCancel: () => void;
  onConfirm: (duplicateId: string, targetId: string) => void;
}> = ({ open, isMerging, serverError, onCancel, onConfirm }) => {
  const [duplicate, setDuplicate] = useState<Player | null>(null);
  const [target, setTarget] = useState<Player | null>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) {
      setDuplicate(null);
      setTarget(null);
      setTyped('');
    }
  }, [open]);

  const expected = duplicate ? fullName(duplicate) : '';
  const canConfirm = !!duplicate && !!target && typed === expected && !isMerging;

  return (
    <Modal open={open} onClose={onCancel} title="Merge duplicate players" size="md" closeOnBackdropClick={!isMerging} closeOnEscape={!isMerging}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) onConfirm(duplicate.id, target.id);
        }}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Everything the duplicate has recorded — team places, match stats and rosters — moves onto the
          player you keep, and the duplicate profile is then deleted for good.
        </p>

        {serverError && (
          <p role="alert" className="rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
            {serverError}
          </p>
        )}

        <PlayerPicker
          id="merge-duplicate"
          label="Duplicate (will be deleted)"
          selected={duplicate}
          onSelect={(p) => { setDuplicate(p); setTyped(''); }}
          excludeId={target?.id}
          disabled={isMerging}
        />
        <PlayerPicker
          id="merge-target"
          label="Player to keep"
          selected={target}
          onSelect={setTarget}
          excludeId={duplicate?.id}
          disabled={isMerging}
        />

        {duplicate && target && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning-100 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
            <p className="text-sm text-warning-700 dark:text-warning-500">
              <strong>{expected}</strong> will be merged into <strong>{fullName(target)}</strong> and deleted. This can’t be undone.
            </p>
            <label htmlFor="merge-confirm" className="mt-1 text-sm font-medium text-warning-700 dark:text-warning-500">
              Type <span className="font-semibold">{expected}</span> to confirm
            </label>
            <input
              id="merge-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-warning-100 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-warning-500 dark:border-warning-500/40 dark:bg-gray-900 dark:text-white"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isMerging}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-error-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-error-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMerging && <Spinner />}
            {isMerging ? 'Merging...' : 'Merge and delete duplicate'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MergePlayersDialog;
