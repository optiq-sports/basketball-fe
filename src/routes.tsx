import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/login';
import ForgotPassword from './pages/login/ForgotPassword';
import Dashboard from './pages/dashboard/dashboard';
import Wrapper from './components/wrapper';

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

