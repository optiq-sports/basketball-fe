import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/hooks';
import { performLogout } from '../../auth/authSession';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';

/**
 * Shown instead of the normal app when the account must change its password first
 * (`PASSWORD_CHANGE_REQUIRED`; see docs/BACKEND_GAPS.md Gap #27). The access token is kept, because
 * `POST /auth/change-password` is the one route exempt from the lock and needs it.
 */
const ChangePasswordRequired: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOutInstead = () => {
    performLogout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-court-50 px-4 dark:bg-court-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Set a new password</h1>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          Your account was created with a temporary password. Choose a new one to continue.
        </p>
        <div className="mt-5">
          <ChangePasswordForm onChanged={onChanged} autoFocus />
        </div>
        <button
          type="button"
          onClick={handleSignOutInstead}
          className="mt-4 w-full text-center text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  );
};

export default ChangePasswordRequired;
