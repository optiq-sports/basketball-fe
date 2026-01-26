import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Demo credentials check
    if (email === 'superadmin@optiqsports.com' && password === 'superadmin123') {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'super_admin');
      localStorage.setItem('currentUser', JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'superadmin@optiqsports.com',
        role: 'super_admin'
      }));
      navigate('/dashboard');
    } else if (email === 'admin@optiqsports.com' && password === 'admin123') {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('currentUser', JSON.stringify({
        id: 2,
        name: 'Admin User',
        email: 'admin@optiqsports.com',
        role: 'admin'
      }));
      navigate('/dashboard');
    } else if (email && password) {
      // Default to admin for other credentials
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('currentUser', JSON.stringify({
        id: Date.now(),
        name: email.split('@')[0],
        email: email,
        role: 'admin'
      }));
      navigate('/dashboard');
    } else {
      alert('Please enter email and password');
    }
  };

  const handleQuickLogin = (userEmail: string, userPassword: string, userRole: 'super_admin' | 'admin', userName: string, userId: number) => {
    setEmail(userEmail);
    setPassword(userPassword);
    
    // Small delay to show the credentials being filled, then login
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('currentUser', JSON.stringify({
        id: userId,
        name: userName,
        email: userEmail,
        role: userRole
      }));
      navigate('/dashboard');
    }, 100);
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="min-h-screen w-full bg-[#F5FCFF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/logo.png" alt="logo" className='w-40 h-40 ' />
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-10">
          <h1 className="text-3xl text-gray-700 mb-2">
            Welcome back <span className="font-semibold text-gray-900">admin</span>
          </h1>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Login</span> to proceed to your dashboard
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-3.5">
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 text-base placeholder-gray-500"
          />

          {/* Password Input */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 text-base placeholder-gray-500"
          />

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all text-base"
          >
            Login
          </button>
        </form>

        <div className="space-y-3.5 mt-6">
          {/* Quick Login Credentials */}
          <div className="space-y-2.5">
            <p className="text-sm text-gray-600 text-center mb-3">Quick Login:</p>
            
            {/* Super Admin Credential */}
            <button
              onClick={() => handleQuickLogin('superadmin@optiqsports.com', 'superadmin123', 'super_admin', 'Super Admin', 1)}
              className="w-full py-3 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border border-purple-200 text-gray-700 font-medium rounded-xl transition-all text-sm"
            >
              <div className="text-left px-2">
                <div className="font-semibold text-purple-900">Super Admin</div>
                <div className="text-xs text-gray-600 mt-0.5">superadmin@optiqsports.com</div>
              </div>
            </button>

            {/* Admin Credential */}
            <button
              onClick={() => handleQuickLogin('admin@optiqsports.com', 'admin123', 'admin', 'Admin User', 2)}
              className="w-full py-3 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 text-gray-700 font-medium rounded-xl transition-all text-sm"
            >
              <div className="text-left px-2">
                <div className="font-semibold text-blue-900">Admin</div>
                <div className="text-xs text-gray-600 mt-0.5">admin@optiqsports.com</div>
              </div>
            </button>
          </div>

          {/* Forgot Password Link */}
          <div className="text-center pt-4">
            <button
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-all"
            >
              Forgot Password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;