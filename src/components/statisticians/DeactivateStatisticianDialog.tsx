import React from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { btnDanger, btnSecondary } from '../ui/formStyles';

export interface DeactivateTarget {
  id: string;
  name: string;
}

/**
 * Deactivating is reversible: `DELETE /statistician/:id` only sets the account's status to INACTIVE.
 * They can no longer sign in or be assigned to matches, but their account and every game they scored
 * stay, and Reactivate on the Inactive tab brings them back. So a plain confirmation is enough.
 */
const DeactivateStatisticianDialog: React.FC<{
  target: DeactivateTarget | null;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isWorking, onCancel, onConfirm }) => (
  <Modal open={!!target} onClose={onCancel} title="Deactivate statistician?" size="sm" closeOnBackdropClick={!isWorking} closeOnEscape={!isWorking}>
    {target && (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>{target.name}</strong> will no longer be able to sign in or be assigned to matches. The games they
          scored and their profile stay, and you can reactivate them from the Inactive tab.
        </p>
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          <button type="button" className={btnSecondary} onClick={onCancel} disabled={isWorking}>Cancel</button>
          <button type="button" className={btnDanger} onClick={onConfirm} disabled={isWorking}>
            {isWorking && <Spinner />}
            {isWorking ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    )}
  </Modal>
);

export default DeactivateStatisticianDialog;
