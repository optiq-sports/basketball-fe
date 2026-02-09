import React, { useState, useRef, useEffect } from 'react'
import { FiSearch, FiBell, FiSettings, FiLogOut } from 'react-icons/fi'
import { HiMenu } from 'react-icons/hi'
import { IoChevronDown } from 'react-icons/io5'

interface NavbarProps {
  onMenuClick?: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  onMenuClick,
  userName = 'Admin User',
  userRole = 'Administrator',
  onLogout
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="h-20 bg-[#F8F8F8] border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left Section - Logo & Mobile Menu */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <HiMenu className="text-2xl text-gray-600" />
        </button>

        {/* Logo - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex items-center gap-3">
          <img src="/logo.png" alt="logo" className='w-10 h-10' />
          <span className="text-lg font-semibold text-gray-800">OptiqSports</span>
        </div>
      </div>

      {/* Center Section - Search Bar (Desktop Only) */}
      <div className="hidden lg:flex flex-1 justify-center px-8">
        <div className="relative max-w-2xl w-full">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder="Search tournaments, teams, players..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right Section - Notifications, Settings & Profile */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <FiBell className="text-xl text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Settings */}
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <FiSettings className="text-xl text-gray-600" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200"></div>

        {/* User Profile with optional dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-gray-800">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
            </div>
            <IoChevronDown className="text-gray-400 hidden md:block" />
          </button>

          {profileOpen && onLogout && (
            <div className="absolute right-0 mt-1 w-48 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <FiLogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
