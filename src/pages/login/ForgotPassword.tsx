import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { GATEWAY_DISPLAY_FONT_STACK as DISPLAY_FONT_STACK, GATEWAY_FONT_STACK as FONT_STACK } from '../../authGatewayTheme';

/**
 * There is no way to reset a password by email yet: the backend has no forgot or reset endpoint
 * (Gap 46), so this page used to say "We've sent a password reset link" while sending nothing. It now
 * says what is true and who can actually help. An administrator can set a new password for an admin or
 * a statistician from the Admins and Statisticians screens.
 */
const ForgotPassword: React.FC = () => (
  <div className="flex min-h-[100dvh] w-full items-center justify-center bg-[#0a0e15] p-6" style={{ fontFamily: FONT_STACK }}>
    <div className="w-full max-w-sm">
      <Link to="/login" className="mb-8 flex w-fit items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80">
        <FiArrowLeft aria-hidden />
        Back to sign in
      </Link>

      <h1 className="text-3xl leading-tight tracking-tight text-white" style={{ fontFamily: DISPLAY_FONT_STACK }}>
        Forgot your password?
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-white/60">
        Resetting a password by email isn’t available yet. Ask the administrator who set up your account to
        reset it for you, then sign in with the new one.
      </p>
      <p className="mt-3 text-sm text-white/40">
        If you are the administrator, another super administrator can reset yours from the Admins screen.
      </p>

      <Link
        to="/login"
        className="mt-8 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#2563eb] py-3.5 text-[15px] font-semibold text-white transition-all hover:brightness-110"
      >
        Back to sign in
      </Link>
    </div>
  </div>
);

export default ForgotPassword;
