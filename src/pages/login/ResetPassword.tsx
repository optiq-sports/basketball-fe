import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useResetPassword } from '../../api/hooks';

/** The backend's `ResetPasswordDto` has `@MinLength(8)`, so anything shorter is refused server-side. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * `/reset-password?token=…` — the other half of the forgot-password flow, and the page the emailed link
 * points at: `EmailService.sendPasswordResetEmail` builds
 * `${FRONTEND_URL}/reset-password?token=<uuid>`, so without this route the link landed nowhere.
 *
 * Styled to match the restored Forgot Password page rather than invented separately.
 *
 * The token is read from the query string and never shown or edited — it is a credential, so it stays
 * out of the form, out of the page text and out of any error message. `POST /auth/reset-password`
 * answers 401 for a token that is wrong, already used or more than an hour old; that is reported as
 * something to act on (ask for a new link) rather than as a bare error.
 */
const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const resetPassword = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setError(null);
    resetPassword.mutate(
      { token, newPassword: password },
      {
        onSuccess: () => setDone(true),
        onError: (err) => setError(err.message),
      },
    );
  };

  // A link that arrives without a token can't be used, and there is nothing to type that would fix it.
  if (!token) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F5FCFF] p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="mb-3 text-2xl font-semibold text-gray-900">This link isn’t complete</h1>
          <p className="mb-8 text-base text-gray-600">
            A password reset link carries a one-time token. Open the link from your email in full, or ask
            for a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white transition-all hover:bg-brand-700"
          >
            Send a new link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#F5FCFF] p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-success-500 shadow-lg">
              <svg aria-hidden className="size-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-gray-900">Password changed</h1>
          <p className="mb-8 text-base text-gray-600">Sign in with your new password.</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="w-full cursor-pointer rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white transition-all hover:bg-brand-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const expired = /invalid or expired/i.test(error ?? '');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F5FCFF] p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-8 flex w-fit items-center gap-2 text-gray-600 transition-colors hover:text-gray-800">
          <FiArrowLeft aria-hidden className="text-xl" />
          <span className="text-sm">Back to Login</span>
        </Link>

        <div className="mb-8 flex justify-center">
          <div aria-hidden className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-lg">
            <div className="size-8 rotate-45 rounded-lg border-4 border-white" />
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-semibold text-gray-900">Set a new password</h1>
          <p className="text-sm text-gray-600">
            Choose a password of at least {MIN_PASSWORD_LENGTH} characters. The reset link lasts one hour.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="new-password"
              autoFocus
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3.5 text-base text-gray-900 placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              autoComplete="new-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'reset-error' : undefined}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3.5 text-base text-gray-900 placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="size-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Show passwords
          </label>

          {error && (
            <div id="reset-error" role="alert" className="rounded-xl border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700">
              <p>{error}</p>
              {expired && (
                <Link to="/forgot-password" className="mt-1 inline-block font-semibold underline">
                  Ask for a new link
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={resetPassword.isPending}
            className="w-full cursor-pointer rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resetPassword.isPending ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
