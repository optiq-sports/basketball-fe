import React, { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AUTH_SESSION_EXPIRED_EVENT, clearAuthTokens, getAccessToken } from './auth/authSession';
import { decideGate } from './auth/gateDecision';
import { useQueryClient } from '@tanstack/react-query';
import Login from './pages/login/login';
import ForgotPassword from './pages/login/ForgotPassword';
import ChangePasswordRequired from './pages/login/ChangePasswordRequired';
import Wrapper from './components/wrapper';
import { useProfile, queryKeys } from './api/hooks';
import { ROLE_STATISTICIAN } from './constants/roles';
import { StatisticianTeamColorsProvider } from './contexts/StatisticianTeamColorsContext';
import { enterFullscreenBestEffort } from './utils/enterFullscreen';

const MatchKey = lazy(() => import('./pages/matchKey/MatchKey'));
const Starters = lazy(() => import('./pages/starters/Starters'));
const ChooseSides = lazy(() => import('./pages/choose/ChooseSides'));
const JumpBall = lazy(() => import('./pages/jump/JumpBall'));
const StatDash = lazy(() => import('./pages/statDash/StatDash'));

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] text-gray-500 text-sm">
    Loading…
  </div>
);

const UnreachableScreen: React.FC<{ onRetry: () => void; retrying: boolean }> = ({ onRetry, retrying }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F4F7F9] px-6 text-center">
    <p className="text-lg font-semibold text-gray-800">Can&rsquo;t reach the server</p>
    <p className="max-w-sm text-sm text-gray-600">
      You&rsquo;re still signed in. Anything you&rsquo;ve recorded is saved on this device and will sync once
      you&rsquo;re back online. This page reconnects on its own, or you can retry now.
    </p>
    <button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
    >
      {retrying ? 'Retrying…' : 'Retry'}
    </button>
  </div>
);

/** Resolves auth token and forks STATISTICIAN users into isolated routes vs main app shell. */
const AppGate: React.FC = () => {
  const hasToken = typeof window !== 'undefined' && !!getAccessToken();
  const profile = useProfile(hasToken);
  const queryClient = useQueryClient();

  const decision = decideGate({
    hasToken,
    isLoading: profile.isLoading,
    isPaused: profile.fetchStatus === 'paused',
    isError: profile.isError,
    hasData: profile.data !== undefined,
    error: profile.error,
  });

  if (decision === 'login') {
    // Reaching here with a token means the server itself refused it (401/403) — ApiClient's
    // request() already tried a silent refresh-and-retry first (see refreshAccessToken in
    // src/auth/authSession.ts). Clear everything, not just the access token, so a stale
    // refresh token doesn't linger. Merely being offline never lands here (see decideGate).
    if (hasToken) {
      clearAuthTokens();
      queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    }
    return <Navigate to="/login" replace />;
  }

  if (decision === 'loading') {
    return <LoadingScreen />;
  }

  if (decision === 'unreachable') {
    return <UnreachableScreen onRetry={() => void profile.refetch()} retrying={profile.isFetching} />;
  }

  if (decision === 'password-change') {
    return <ChangePasswordRequired onChanged={() => void profile.refetch()} />;
  }

  const rawRole = (profile.data as { role?: string } | undefined)?.role;

  if (rawRole === ROLE_STATISTICIAN) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <StatisticianRoutes />
      </Suspense>
    );
  }

  return <Wrapper />;
};

/** One attempt when the statistician app tree mounts (covers refresh and deep links). */
const StatisticianFullscreenOnEnter: React.FC = () => {
  useLayoutEffect(() => {
    enterFullscreenBestEffort();
  }, []);
  return null;
};

const StatisticianRoutes: React.FC = () => (
  <StatisticianTeamColorsProvider>
    <StatisticianFullscreenOnEnter />
    <Routes>
      <Route path="/match-key" element={<MatchKey />} />
      <Route path="/starters" element={<Starters />} />
      <Route path="/choose-sides" element={<ChooseSides />} />
      <Route path="/jump-ball" element={<JumpBall />} />
      <Route path="/stat-dash" element={<StatDash />} />
      <Route path="*" element={<Navigate to="/match-key" replace />} />
    </Routes>
  </StatisticianTeamColorsProvider>
);

/** React to 401 from ApiClient: clear query cache and send user to login. */
const AuthSessionListener: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onSessionExpired = () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [navigate, queryClient]);

  return null;
};

const AppRoutes: React.FC = () => {
  return (
    <>
      <AuthSessionListener />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/*" element={<AppGate />} />
      </Routes>
    </>
  );
};

export default AppRoutes;
