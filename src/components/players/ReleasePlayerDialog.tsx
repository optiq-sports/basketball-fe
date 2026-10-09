import React from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';

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
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          This takes <strong>{target.name}</strong>
          {target.teams.length > 0 ? (
            <> off {target.teams.length === 1 ? <strong>{target.teams[0]}</strong> : <>their {target.teams.length} teams ({target.teams.join(', ')})</>}</>
          ) : (
            ' off every team'
          )}
          . Their profile and everything they've recorded stay — you can sign them to a team again later.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onCancel} disabled={isReleasing}>Cancel</Button>
          <Button variant="destructive" type="button" onClick={onConfirm} disabled={isReleasing}>
            {isReleasing && <Spinner />}
            {isReleasing ? 'Releasing…' : 'Release player'}
          </Button>
        </div>
      </div>
    )}
  </Modal>
);

export default ReleasePlayerDialog;
