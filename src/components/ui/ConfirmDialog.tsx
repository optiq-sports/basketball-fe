import React from 'react';
import Modal from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={isLoading}
          className={`cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            tone === 'danger' ? 'bg-error-500 hover:bg-error-600' : 'bg-brand-500 hover:bg-brand-600'
          }`}
        >
          {isLoading ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
