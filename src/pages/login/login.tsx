import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useLogin } from '../../api/hooks';
import { ROLE_STATISTICIAN } from '../../constants/roles';
import { enterFullscreenBestEffort } from '../../utils/enterFullscreen';
import GrainOverlay from '../../components/decor/GrainOverlay';
import { GATEWAY_DISPLAY_FONT_STACK as DISPLAY_FONT_STACK, GATEWAY_FONT_STACK as FONT_STACK } from '../../authGatewayTheme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const login = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (res) => {
          const role = (res.data?.user as { role?: string } | undefined)?.role;
          if (role === ROLE_STATISTICIAN) {
            enterFullscreenBestEffort();
            navigate('/match-key');
            return;
          }
          navigate('/dashboard');
        },
      }
    );
  };

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#0a0e15] lg:grid lg:grid-cols-[1.15fr_1fr]"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* Visual / brand panel — desktop only */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-14 xl:px-20">
        <img
          src="/login-hero.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070b]/95 via-[#05070b]/45 to-[#05070b]/70" />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#0a0e15]" />
        <GrainOverlay />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
            <img src="/logo.png" alt="" aria-hidden className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <span className="text-[15px] font-semibold tracking-[0.28em] text-white">
            OPTIQ<span className="font-normal text-white/60"> SPORTS</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1
            className="text-[3.4rem] leading-[0.95] tracking-tight text-white xl:text-[4rem]"
            style={{ fontFamily: DISPLAY_FONT_STACK, textWrap: 'balance' as React.CSSProperties['textWrap'] }}
          >
            Built for the scorer&rsquo;s table.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
            Tournament operations and live scorekeeping, from tip-off to final buzzer.
          </p>
        </div>
      </div>

      {/* Compact hero strip — mobile only */}
      <div className="relative h-40 w-full overflow-hidden lg:hidden">
        <img
          src="/login-hero.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[62%_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/60 via-[#05070b]/70 to-[#0a0e15]" />
        <div className="relative z-10 flex h-full items-end px-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
              <img src="/logo.png" alt="" aria-hidden className="h-5 w-5 object-contain brightness-0 invert" />
            </div>
            <span className="text-sm font-semibold tracking-[0.28em] text-white">
              OPTIQ<span className="font-normal text-white/60"> SPORTS</span>
            </span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #38bdf8, transparent 70%)' }}
        />
        <form onSubmit={handleLogin} noValidate className="relative z-10 w-full max-w-sm">
          <h2
            className="text-[2.75rem] leading-none text-white"
            style={{ fontFamily: DISPLAY_FONT_STACK }}
          >
            Sign in
          </h2>
          <p className="mt-3 text-sm text-white/50">Enter your credentials to access your dashboard.</p>

          {login.error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {login.error.message}
            </div>
          )}

          <div className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="text-xs font-medium uppercase tracking-[0.14em] text-white/45"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@optiqsports.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={!!fieldErrors.email}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none transition-colors focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              />
              {fieldErrors.email && <p className="mt-1.5 text-xs text-red-300">{fieldErrors.email}</p>}
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="login-password"
                  className="text-xs font-medium uppercase tracking-[0.14em] text-white/45"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-white/40 transition-colors hover:text-white/80"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-2">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  aria-invalid={!!fieldErrors.password}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 pr-12 text-[15px] text-white placeholder-white/25 outline-none transition-colors focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/35 transition-colors hover:text-white/70 focus:outline-none"
                >
                  {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1.5 text-xs text-red-300">{fieldErrors.password}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="group relative mt-8 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#2563eb] py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {login.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-10 text-center text-xs text-white/25">
            &copy; {new Date().getFullYear()} Optiq Sports. All rights reserved.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
