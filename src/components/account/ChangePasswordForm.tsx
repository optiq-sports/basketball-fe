import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useChangePassword } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { changePasswordSchema, type ChangePasswordFormValues } from './change-password-form';

/**
 * Current / new / confirm password. Used by the forced change screen and by the account page, so the
 * rules and error handling stay in one place. Client checks are a convenience; the server re-checks.
 */
const ChangePasswordForm: React.FC<{ onChanged: () => void; autoFocus?: boolean; className?: string }> = ({
  onChanged,
  autoFocus = false,
  className,
}) => {
  const [showPasswords, setShowPasswords] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
    resolver: zodResolver(changePasswordSchema),
  });
  const changePassword = useChangePassword();
  const toast = useToast();

  const submit = handleSubmit(({ oldPassword, newPassword }) => {
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
  });

  const inputClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

  return (
    <form onSubmit={submit} className={className ?? 'flex flex-col gap-4'} noValidate>
      <div>
        <label htmlFor="cp-old" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Current password
        </label>
        <input
          id="cp-old"
          type={showPasswords ? 'text' : 'password'}
          {...register('oldPassword')}
          autoComplete="current-password"
          autoFocus={autoFocus}
          className={inputClass}
        />
        {errors.oldPassword && <p className="mt-1 text-xs text-rose-600">{errors.oldPassword.message}</p>}
      </div>

      <div>
        <label htmlFor="cp-new" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          New password
        </label>
        <input
          id="cp-new"
          type={showPasswords ? 'text' : 'password'}
          {...register('newPassword')}
          autoComplete="new-password"
          className={inputClass}
        />
        {errors.newPassword && <p className="mt-1 text-xs text-rose-600">{errors.newPassword.message}</p>}
      </div>

      <div>
        <label htmlFor="cp-confirm" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Confirm new password
        </label>
        <input
          id="cp-confirm"
          type={showPasswords ? 'text' : 'password'}
          {...register('confirmPassword')}
          autoComplete="new-password"
          className={inputClass}
        />
        {errors.confirmPassword && <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword.message}</p>}
      </div>

      <button
        type="button"
        onClick={() => setShowPasswords((s) => !s)}
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        {showPasswords ? <FiEyeOff size={14} /> : <FiEye size={14} />}
        {showPasswords ? 'Hide passwords' : 'Show passwords'}
      </button>

      <Button type="submit" disabled={changePassword.isPending} className="mt-1 min-h-11">
        {changePassword.isPending && <Spinner />}
        {changePassword.isPending ? 'Changing password…' : 'Change password'}
      </Button>
    </form>
  );
};

export default ChangePasswordForm;
