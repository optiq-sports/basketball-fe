import React from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';

export interface DeactivateAdminTarget {
  id: string;
  label: string;
}

/**
 * Deactivating is reversible: `DELETE /admin/:id` only sets the account's status to INACTIVE. They
 * can't sign in until someone sets them back to Active from Edit.
 */
const DeactivateAdminDialog: React.FC<{
  target: DeactivateAdminTarget | null;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ target, isWorking, onCancel, onConfirm }) => (
  <Modal open={!!target} onClose={onCancel} title="Deactivate admin?" size="sm" closeOnBackdropClick={!isWorking} closeOnEscape={!isWorking}>
    {target && (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>{target.label}</strong> will no longer be able to sign in. Nothing they created is removed, and you
          can set them back to Active from Edit.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onCancel} disabled={isWorking}>Cancel</Button>
          <Button variant="destructive" type="button" onClick={onConfirm} disabled={isWorking}>
            {isWorking && <Spinner />}
            {isWorking ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </div>
      </div>
    )}
  </Modal>
);

export default DeactivateAdminDialog;
