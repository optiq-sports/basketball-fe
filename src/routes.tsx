import React, { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AUTH_SESSION_EXPIRED_EVENT, clearAuthTokens, getAccessToken } from './auth/authSession';
import { useQueryClient } from '@tanstack/react-query';
import Login from './pages/login/login';
import ForgotPassword from './pages/login/ForgotPassword';
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

/** Resolves auth token and forks STATISTICIAN users into isolated routes vs main app shell. */
const AppGate: React.FC = () => {
  const hasToken = typeof window !== 'undefined' && !!getAccessToken();
  const profile = useProfile(hasToken);
  const queryClient = useQueryClient();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (profile.isLoading) {
    return <LoadingScreen />;
  }

  if (profile.isError) {
    // ApiClient's request() already tried a silent refresh-and-retry before this error
    // surfaced (see refreshAccessToken in src/auth/authSession.ts) — reaching here means
    // that failed too, or there was no refresh token to try. Clear everything, not just
    // the access token, so a stale refresh token doesn't linger.
    clearAuthTokens();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    return <Navigate to="/login" replace />;
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
