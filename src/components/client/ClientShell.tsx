import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Button } from '../ui/primitives/button';

const NAV = [
  { to: '/portal/matches', label: 'Matches' },
  { to: '/portal/keys', label: 'API keys' },
  { to: '/portal/account', label: 'Account' },
];

/**
 * Header for the client portal. Its own shell, not the admin one: a client sees only their own
 * matches and keys, so it doesn't inherit the operational sidebar.
 *
 * It can't show the organisation's name: a CLIENT user has no way to read it (Gap 34), so it shows the
 * product name only.
 */
const ClientShell: React.FC<{ children: React.ReactNode; userName?: string; onLogout: () => void }> = ({
  children,
  userName,
  onLogout,
}) => (
  <div className="min-h-screen bg-court-50 dark:bg-court-950">
    <header className="bg-court-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/portal/matches" className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50">
          <img src="/logo.png" alt="" className="size-8" />
          <span className="text-sm font-bold tracking-wide">OPTIQ SPORTS</span>
          <span className="rounded-full bg-signal-500/20 px-2 py-0.5 text-xs font-semibold text-signal-300">Client portal</span>
        </Link>
        <div className="flex items-center gap-3">
          {userName && <span className="hidden text-sm text-court-200 sm:block">{userName}</span>}
          <Button variant="ghost" size="sm" className="text-court-100 hover:bg-court-800 hover:text-white" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
      <nav aria-label="Portal sections" className="mx-auto max-w-7xl px-4 md:px-6">
        <ul className="flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-11 items-center px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                    isActive ? 'text-white' : 'text-court-300 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-signal-500" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
    <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
  </div>
);

export default ClientShell;
