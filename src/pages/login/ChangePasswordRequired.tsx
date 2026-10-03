import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useChangePassword, queryKeys } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { performLogout } from '../../auth/authSession';
import Spinner from '../../components/ui/Spinner';

/**
 * Shown instead of the normal app when `GET /auth/profile` says this account's password must be
 * changed before anything else (`PASSWORD_CHANGE_REQUIRED` — a new admin/statistician created
 * with an auto-generated password; see docs/BACKEND_GAPS.md Gap #27). The access token is kept —
 * `POST /auth/change-password` is the one route exempt from the lock, and needs it.
 *
 * "Current password" is whatever they just signed in with a moment ago (the one emailed to
 * them, for an auto-generated account) — asked again here because the backend's own
 * `change-password` endpoint requires it, same as a voluntary password change would.
 */
const ChangePasswordRequired: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ oldPassword?: string; newPassword?: string; confirmPassword?: string }>({});
  const changePassword = useChangePassword();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOutInstead = () => {
    performLogout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!oldPassword) errors.oldPassword = 'Enter your current password.';
    if (!newPassword) errors.newPassword = 'Choose a new password.';
    else if (newPassword.length < 6) errors.newPassword = 'At least 6 characters.';
    if (newPassword && oldPassword && newPassword === oldPassword) {
      errors.newPassword = 'Choose a password different from your current one.';
    }
    if (confirmPassword !== newPassword) errors.confirmPassword = "Doesn't match the new password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    changePassword.mutate(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed.');
          onChanged();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F4F7F9] px-4">
      <div className="w-full max-w-sm border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Set a new password</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          Your account was created with a temporary password. Choose a new one to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="cpr-old" className="mb-1.5 block text-sm font-medium text-gray-700">
              Current (temporary) password
            </label>
            <input
              id="cpr-old"
              type={showPasswords ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {fieldErrors.oldPassword && <p className="mt-1 text-xs text-rose-600">{fieldErrors.oldPassword}</p>}
          </div>

          <div>
            <label htmlFor="cpr-new" className="mb-1.5 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="cpr-new"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {fieldErrors.newPassword && <p className="mt-1 text-xs text-rose-600">{fieldErrors.newPassword}</p>}
          </div>

          <div>
            <label htmlFor="cpr-confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <input
              id="cpr-confirm"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-rose-600">{fieldErrors.confirmPassword}</p>}
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((s) => !s)}
            className="-mt-2 flex w-fit items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            {showPasswords ? <FiEyeOff size={14} /> : <FiEye size={14} />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          <button
            type="submit"
            disabled={changePassword.isPending}
            className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {changePassword.isPending && <Spinner className="size-4" />}
            {changePassword.isPending ? 'Changing password…' : 'Change password & continue'}
          </button>

          <button
            type="button"
            onClick={handleSignOutInstead}
            className="text-center text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Not you? Sign out
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordRequired;
