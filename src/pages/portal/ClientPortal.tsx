import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useProfile } from '../../api/hooks';
import { performLogout } from '../../auth/authSession';
import ClientShell from '../../components/client/ClientShell';

const PortalMatches = lazy(() => import('./PortalMatches'));
const PortalMatchDetail = lazy(() => import('./PortalMatchDetail'));
const PortalKeys = lazy(() => import('./PortalKeys'));
const PortalAccount = lazy(() => import('./PortalAccount'));

const PageFallback = () => <div className="p-6 text-sm text-gray-500">Loading…</div>;

/**
 * The client portal for CLIENT-role users. Reached only through AppGate, which decides the role; the
 * backend still enforces what each request may read. Every path here is under /portal.
 */
const ClientPortal: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const user = profile.data as { name?: string | null; email?: string } | undefined;

  const handleLogout = () => {
    performLogout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  return (
    <ClientShell userName={user?.name ?? user?.email} onLogout={handleLogout}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/portal/matches" element={<PortalMatches />} />
          <Route path="/portal/matches/:matchId" element={<PortalMatchDetail />} />
          <Route path="/portal/keys" element={<PortalKeys />} />
          <Route path="/portal/account" element={<PortalAccount />} />
          <Route path="*" element={<Navigate to="/portal/matches" replace />} />
        </Routes>
      </Suspense>
    </ClientShell>
  );
};

export default ClientPortal;
