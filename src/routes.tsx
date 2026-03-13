import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/login';
import ForgotPassword from './pages/login/ForgotPassword';
import Dashboard from './pages/dashboard/dashboard';
import Wrapper from './components/wrapper';
import MatchKey from './pages/matchKey/MatchKey';
import Starters from './pages/staters/Starts';
import ChooseSides from './pages/choose/ChooseSides';
import JumpBall from './pages/Jump/JumpBall';
import StatDash from './pages/stat/StatDash';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const TOKEN_KEY = 'access_token';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const hasToken = !!localStorage.getItem(TOKEN_KEY);
  return hasToken ? <>{children}</> : <Navigate to="/login" replace />;
};

// Main Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/match-key"
        element={
          <ProtectedRoute>
            <MatchKey />
          </ProtectedRoute>
        }
      />
      <Route
        path="/starters"
        element={
          <ProtectedRoute>
            <Starters />
          </ProtectedRoute>
        }
      />
      <Route
        path="/choose-sides"
        element={
          <ProtectedRoute>
            <ChooseSides />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jump-ball"
        element={
          <ProtectedRoute>
            <JumpBall />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stat-dash"
        element={
          <ProtectedRoute>
            <StatDash />
          </ProtectedRoute>
        }
      />
      
      {/* Protected Routes - Wrapped in Layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Wrapper />
          </ProtectedRoute>
        }
      />
      
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;

