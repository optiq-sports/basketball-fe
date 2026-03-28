import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Login from './pages/login/login';
import ForgotPassword from './pages/login/ForgotPassword';
import Wrapper from './components/wrapper';
import { useProfile, queryKeys } from './api/hooks';
import { ROLE_STATISTICIAN } from './constants/roles';
import { StatisticianTeamColorsProvider } from './contexts/StatisticianTeamColorsContext';
import { enterFullscreenBestEffort } from './utils/enterFullscreen';

const TOKEN_KEY = 'access_token';

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
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY);
  const profile = useProfile(hasToken);
  const queryClient = useQueryClient();

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  if (profile.isLoading) {
    return <LoadingScreen />;
  }

  if (profile.isError) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_name');
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

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/*" element={<AppGate />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
