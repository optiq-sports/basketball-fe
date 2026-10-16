import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useForgotPassword } from '../../api/hooks';
import { EMAIL_RE } from '../../lib/form';

/**
 * Ask for a password reset link, back to the pre-redesign layout: the light `#F5FCFF` panel, the back
 * link, the rounded logo tile, the centred heading, one email field and a full-width Send Reset Link
 * button, then the green-check confirmation.
 *
 * **It now actually sends the request.** The old page called nothing at all — `handleSubmit` set
 * `isSubmitted` and redirected after three seconds — and told the user "We've sent a password reset
 * link to {email}", which was untrue (Gap 46, Bug 117). `POST /auth/forgot-password` exists and works
 * as of the 14 Oct backend push, with the migration that adds the columns it needs (Gap 54, resolved).
 *
 * **The confirmation is careful about what it claims.** The backend answers `{ success: true }` whether
 * or not the email belongs to an account, so that the response can't be used to find out who has one.
 * So the page says the link has been sent *if the address is on an account* — it cannot honestly say
 * more, and the email itself is still subject to Gap 49 (the backend falls back to a fake SMTP
 * transport and swallows send failures), which is why the note about asking an administrator stays.
 */
const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const forgotPassword = useForgotPassword();

  const send = (address: string) => {
    forgotPassword.mutate(address, {
      onSuccess: () => setIsSubmitted(true),
      onError: (err) => setError(err.message),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) {
      setError('Enter your email address.');
      return;
    }
    if (!EMAIL_RE.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    send(address);
  };

  if (isSubmitted) {
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

          <h1 className="mb-3 text-2xl font-semibold text-gray-900">Check your email</h1>
          <p className="mb-6 text-base text-gray-600">
            If <span className="font-semibold text-gray-900">{email.trim()}</span> is on an account, a
            password reset link is on its way. The link lasts one hour.
          </p>
          <p className="mb-8 text-sm text-gray-500">
            Nothing arrived? Check your spam folder,{' '}
            <button
              type="button"
              onClick={() => send(email.trim())}
              disabled={forgotPassword.isPending}
              className="cursor-pointer font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgotPassword.isPending ? 'sending…' : 'send it again'}
            </button>
            , or ask the administrator who set up your account to reset it for you.
          </p>

          <Link to="/login" className="text-sm text-brand-600 transition-all hover:text-brand-700 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

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
          <h1 className="mb-3 text-3xl font-semibold text-gray-900">Forgot Password?</h1>
          <p className="text-sm text-gray-600">
            No worries. Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'email-error' : undefined}
              className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3.5 text-base text-gray-900 placeholder-gray-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {error && (
              <p id="email-error" role="alert" className="mt-2 text-sm text-error-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={forgotPassword.isPending}
            className="w-full cursor-pointer rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {forgotPassword.isPending ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-brand-600 transition-all hover:text-brand-700 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
