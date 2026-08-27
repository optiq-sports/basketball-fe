import React, { Suspense, lazy } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile, queryKeys } from '../api/hooks'
import { ThemeProvider } from '../contexts/ThemeContext'
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext'
import AdminTopbar from './admin/AdminTopbar'
import AdminSidebar from './admin/AdminSidebar'
import Backdrop from './admin/Backdrop'

const MatchPage = lazy(() => import('../pages/tournaments/Match'))
const PlayerDetails = lazy(() => import('../pages/tournaments/PlayerDetails'))
const Dashboard = lazy(() => import('../pages/dashboard/dashboard'))
const StartNew = lazy(() => import('../pages/StartNew/StartNew'))
const Teams = lazy(() => import('../pages/StartNew/Teams'))
const Players = lazy(() => import('../pages/StartNew/Players'))
const TeamOverview = lazy(() => import('../pages/StartNew/TeamOverview'))
const Complete = lazy(() => import('../pages/StartNew/Complete'))
const TournamentsListing = lazy(() => import('../pages/tournaments/TournamentsListing'))
const Tournaments = lazy(() => import('../pages/tournaments/Tournaments'))
const Fixtures = lazy(() => import('../pages/tournaments/Fixtures'))
const Schedules = lazy(() => import('../pages/tournaments/Schedules'))
const PendingGames = lazy(() => import('../pages/tournaments/PendingGames'))
const Results = lazy(() => import('../pages/results/result'))
const ShotChart = lazy(() => import('../pages/tournaments/ShotChart'))
const Statisticians = lazy(() => import('../pages/Statisticians/Statisticians'))
const ViewStat = lazy(() => import('../pages/Statisticians/viewStat'))
const TeamsManagement = lazy(() => import('../pages/Teams/Teams'))
const TeamDetails = lazy(() => import('../pages/Teams/TeamDetails'))
const PlayersManagement = lazy(() => import('../pages/Players/Players'))
const PlayerProfile = lazy(() => import('../pages/Players/PlayerProfile'))
const Users = lazy(() => import('../pages/Users/Users'))
const QueueDashboard = lazy(() => import('../pages/Ops/QueueDashboard'))

const TOKEN_KEY = 'access_token';

const UsersRouteGuard: React.FC<{ rawRole?: string }> = ({ rawRole }) => {
  if (rawRole === undefined) {
    return <div className="p-6 flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (rawRole !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Users />;
};

function formatRole(role: string): string {
  if (role === 'SUPER_ADMIN') return 'Super Administrator';
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'STATISTICIAN') return 'Statistician';
  return role;
}

const WrapperContent: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const profileData = profile.data;
  const rawRole = (profileData as { role?: string } | undefined)?.role;
  const storedName = typeof window !== 'undefined' ? localStorage.getItem('user_name') : null;
  const userName = storedName
    || (profileData as { name?: string; email?: string } | undefined)?.name?.trim()
    || (profileData as { name?: string; email?: string } | undefined)?.email
    || 'User';
  const userRole = rawRole ? formatRole(rawRole) : 'Administrator';

  // Single source of truth for logout — previously duplicated (and out of sync
  // with the real auth keys) in the old standalone Sidebar component.
  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_name');
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  const mainContentMargin = isMobileOpen ? 'ml-0' : isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]';

  return (
    <div className="admin-shell min-h-screen xl:flex">
      <AdminSidebar userRole={rawRole} />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        <AdminTopbar userName={userName} userRole={userRole} onLogout={handleLogout} />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Suspense fallback={<div className="p-6 flex items-center justify-center text-gray-500">Loading...</div>}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/start-new" element={<StartNew />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/players" element={<Players />} />
              <Route path="/team-overview" element={<TeamOverview />} />
              <Route path="/complete" element={<Complete />} />
              <Route path="/tournaments" element={<TournamentsListing />} />
              <Route path="/tournaments/:id" element={<Tournaments />} />
              <Route path="/tournaments/:id/fixtures" element={<Fixtures />} />
              <Route path="/tournaments/:id/schedules" element={<Schedules />} />
              <Route path="/tournaments/:id/match/:matchId/pending" element={<PendingGames />} />
              <Route path="/tournaments/:id/match/:matchId/shotchart" element={<ShotChart />} />
              <Route path="/tournaments/:id/match/:matchId" element={<MatchPage />} />
              <Route path="/tournaments/:id/match/:matchId/player/:playerId" element={<PlayerDetails />} />
              <Route path="/results" element={<Results />} />
              <Route path="/statisticians" element={<Statisticians />} />
              <Route path="/statisticians/:id" element={<ViewStat />} />
              <Route path="/teams-management" element={<TeamsManagement />} />
              <Route path="/teams-management/:id" element={<TeamDetails />} />
              <Route path="/players-management" element={<PlayersManagement />} />
              <Route path="/players-management/:playerId" element={<PlayerProfile />} />
              <Route path="/users" element={<UsersRouteGuard rawRole={rawRole} />} />
              <Route path="/ops/queues" element={<QueueDashboard />} />
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
};

const Wrapper: React.FC = () => (
  <ThemeProvider>
    <SidebarProvider>
      <WrapperContent />
    </SidebarProvider>
  </ThemeProvider>
);

export default Wrapper;
