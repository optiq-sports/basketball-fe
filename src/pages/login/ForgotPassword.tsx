import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useToast } from '../../hooks/useToast';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // Simulate password reset email sent
      setIsSubmitted(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } else {
      toast.error('Please enter your email address');
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen w-full bg-[#F5FCFF] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Check your email</h1>
          <p className="text-base text-gray-600 mb-6">
            We've sent a password reset link to<br />
            <span className="font-semibold text-gray-900">{email}</span>
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Didn't receive the email? Check your spam folder or{' '}
            <button onClick={handleSubmit} className="text-blue-600 hover:underline font-medium">
              resend
            </button>
          </p>

          <button
            onClick={handleBackToLogin}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F5FCFF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={handleBackToLogin}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-8 transition-colors"
        >
          <FiArrowLeft className="text-xl" />
          <span className="text-sm">Back to Login</span>
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 rounded-3xl flex items-center justify-center shadow-lg">
            <div className="w-8 h-8 border-4 border-white rounded-lg transform rotate-45"></div>
          </div>
        </div>

        {/* Header Text */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">Forgot Password?</h1>
          <p className="text-sm text-gray-600">
            No worries! Enter your email address and we'll send you<br />
            a link to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 text-base placeholder-gray-500"
          />

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all text-base"
          >
            Send Reset Link
          </button>
        </form>

        {/* Additional Info */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Remember your password?{' '}
            <button
              onClick={handleBackToLogin}
              className="text-blue-600 hover:text-blue-700 hover:underline transition-all font-medium"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

