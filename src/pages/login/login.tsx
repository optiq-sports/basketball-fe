import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../../api/hooks';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigate = useNavigate();
  const login = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return;
    }
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/dashboard'),
      }
    );
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
          {login.error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {login.error.message}
            </div>
          )}
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
            disabled={login.isPending}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all text-base"
          >
            {login.isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
