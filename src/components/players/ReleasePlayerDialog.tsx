import React from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';

export interface ReleaseTarget {
  id: string;
  name: string;
  /** The teams they're currently signed to, already normalized for display. */
  teams: string[];
}

/**
 * Releasing a player clears their team assignments. It is *not* a delete: the backend's
 * `DELETE /players/:id` sets every active assignment to `isActive: false` with a `leftAt` date, and
 * leaves the player's profile and recorded stats alone. So this asks for a plain confirmation rather
 * than making the admin type a name — it can be undone by signing them to a team again.
 */
const ReleasePlayerDialog: React.FC<{
  target: ReleaseTarget | null;
  isReleasing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isReleasing, onCancel, onConfirm }) => (
  <Modal open={!!target} onClose={onCancel} title="Release player?" size="sm" closeOnBackdropClick={!isReleasing} closeOnEscape={!isReleasing}>
    {target && (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This takes <strong>{target.name}</strong>
          {target.teams.length > 0 ? (
            <> off {target.teams.length === 1 ? <strong>{target.teams[0]}</strong> : <>their {target.teams.length} teams ({target.teams.join(', ')})</>}</>
          ) : (
            ' off every team'
          )}
          . Their profile and everything they've recorded stay — you can sign them to a team again later.
        </p>
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isReleasing}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isReleasing}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isReleasing && <Spinner />}
            {isReleasing ? 'Releasing...' : 'Release player'}
          </button>
        </div>
      </div>
    )}
  </Modal>
);

export default ReleasePlayerDialog;
