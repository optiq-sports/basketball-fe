import React, { useEffect, useRef, useState } from 'react';
import { useSidebar } from '../../contexts/SidebarContext';
import ThemeToggle from './ThemeToggle';
import { BellIcon, ChevronDownIcon, HamburgerIcon, CloseIcon, SearchIcon, SignOutIcon } from './icons';

interface AdminTopbarProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

/** Sticky header, ported from TailAdmin's AppHeader.tsx onto react-router + our own auth props. */
const AdminTopbar: React.FC<AdminTopbarProps> = ({ userName = 'Admin User', userRole = 'Administrator', onLogout }) => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 flex w-full bg-white border-gray-200 z-30 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="flex items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg dark:border-gray-800 lg:h-11 lg:w-11 lg:border dark:text-gray-400"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? <CloseIcon className="size-6" /> : <HamburgerIcon className="size-4" />}
          </button>

          <div className="hidden lg:block">
            <div className="relative">
              <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
                <SearchIcon className="fill-gray-500 dark:fill-gray-400" />
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tournaments, teams, players…"
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
              />
              <span className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
                <span>⌘</span>
                <span>K</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between w-full gap-4 px-5 py-4 lg:px-0 lg:justify-end">
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <span className="absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400" />
              <BellIcon className="fill-current" />
            </button>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center text-gray-700 dark:text-gray-400"
            >
              <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700">
                <span className="text-sm font-semibold text-white">
                  {userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </span>
              </span>
              <span className="hidden text-left sm:block">
                <span className="block mr-1 font-medium text-theme-sm">{userName}</span>
                <span className="block text-theme-xs text-gray-500 dark:text-gray-400">{userRole}</span>
              </span>
              <ChevronDownIcon
                className={`ml-1 hidden stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 sm:block ${
                  profileOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {profileOpen && onLogout && (
              <div className="absolute right-0 mt-[17px] flex w-[220px] flex-col rounded-2xl border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setProfileOpen(false);
                  }}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-left font-medium text-gray-700 text-theme-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  <SignOutIcon className="fill-gray-500 group-hover:fill-gray-700 dark:group-hover:fill-gray-300" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminTopbar;
