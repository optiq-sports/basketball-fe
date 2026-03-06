import React, { useState, Suspense, lazy } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useProfile, queryKeys } from '../api/hooks'
import Navbar from './navbar'
import Sidebar from './sidbar'

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

const TOKEN_KEY = 'access_token';

function formatRole(role: string): string {
  if (role === 'SUPER_ADMIN') return 'Super Administrator';
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'STATISTICIAN') return 'Statistician';
  return role;
}

const Wrapper: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();

  const profileData = profile.data;
  const userName = (profileData as { name?: string; email?: string } | undefined)?.name?.trim()
    || (profileData as { name?: string; email?: string } | undefined)?.email
    || 'User';
  const userRole = (profileData as { role?: string } | undefined)?.role
    ? formatRole((profileData as { role?: string }).role!)
    : 'Administrator';

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Determine active menu item based on current route
  const getActiveItem = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'dashboard';
    if (path.startsWith('/start-new')) return 'start-new';
    if (path.startsWith('/tournaments')) return 'tournaments';
    if (path.startsWith('/results')) return 'results';
    if (path.startsWith('/statisticians')) return 'statisticians';
    if (path.startsWith('/teams-management')) return 'teams';
    if (path.startsWith('/players-management')) return 'players';
    if (path.startsWith('/users')) return 'users';
    return '';
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      {/* Navbar - Full Width at Top */}
      <Navbar 
        userName={userName}
        userRole={userRole}
        onMenuClick={toggleSidebar}
        onLogout={handleLogout}
      />

      {/* Main Layout - Sidebar and Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Below navbar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-30 top-20
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <Sidebar activeItem={getActiveItem()} onNavigate={toggleSidebar} />
        </div>

        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-transparent z-20 lg:hidden"
            onClick={toggleSidebar}
          ></div>
        )}

        {/* Page Content - Scrollable with Routes */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
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
            <Route path="/users" element={<Users />} />
            <Route path="/" element={<Dashboard />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Wrapper;
