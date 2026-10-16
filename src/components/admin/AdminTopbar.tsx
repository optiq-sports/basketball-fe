import React, { useEffect, useRef, useState } from 'react';
import { useSidebar } from '../../contexts/SidebarContext';
import ThemeToggle from './ThemeToggle';
import GlobalSearch from './GlobalSearch';
import { ChevronDownIcon, HamburgerIcon, CloseIcon, SignOutIcon } from './icons';
import { cn } from '../../lib/utils';

interface AdminTopbarProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

/**
 * Sticky header: sidebar toggle, global search, theme, and the account menu. The search box returned
 * with real behaviour (Fix 129); the notification bell is still out, because there is nothing for it to
 * show until the backend has notifications (Gap 57).
 */
const AdminTopbar: React.FC<AdminTopbarProps> = ({ userName = 'Admin User', userRole = 'Administrator', onLogout }) => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:px-6">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isMobileOpen ? 'Close navigation' : 'Toggle navigation'}
        className="flex size-10 items-center justify-center rounded-md text-gray-600 outline-none hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-brand-500/40 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {isMobileOpen ? <CloseIcon className="size-5" /> : <HamburgerIcon className="size-5" />}
      </button>

      <div className="flex min-w-0 flex-1 justify-start"><GlobalSearch /></div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="flex items-center gap-3 rounded-md py-1 pl-1 pr-2 outline-none hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-brand-500/40 dark:hover:bg-gray-800"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold text-gray-900 dark:text-white">{userName}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{userRole}</span>
            </span>
            <ChevronDownIcon className={cn('hidden size-4 text-gray-500 transition-transform sm:block', profileOpen && 'rotate-180')} />
          </button>

          {profileOpen && onLogout && (
            <div role="menu" className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onLogout();
                  setProfileOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:ring-[3px] focus-visible:ring-brand-500/40 outline-none dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <SignOutIcon className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminTopbar;
