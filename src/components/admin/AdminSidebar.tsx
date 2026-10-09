import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { menuItems } from './menu';
import { cn } from '../../lib/utils';

interface AdminSidebarProps {
  userRole?: string;
}

/**
 * Collapsible navy rail. Collapses to icons on desktop, expands on hover, and slides in as a drawer
 * on mobile. Items are filtered by role here for presentation only; the API enforces access.
 */
const AdminSidebar: React.FC<AdminSidebarProps> = ({ userRole }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const visibleItems = menuItems.filter(
    (item) => !item.roles || (userRole !== undefined && item.roles.includes(userRole)),
  );

  const showLabels = isExpanded || isHovered || isMobileOpen;
  const wide = isExpanded || isMobileOpen || isHovered;
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-court-800 bg-court-950 text-white transition-all duration-300 ease-in-out mt-16 lg:mt-0',
        wide ? 'w-[260px]' : 'w-[80px]',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('flex h-16 items-center px-5', !showLabels && 'lg:justify-center lg:px-0')}>
        <Link to="/dashboard" className="flex items-center gap-3 rounded-md focus-visible:ring-[3px] focus-visible:ring-court-400/50 outline-none">
          <img src="/logo.png" alt="OptiqSports" className="size-8 shrink-0" />
          {showLabels && <span className="text-base font-bold tracking-wide">OPTIQ SPORTS</span>}
        </Link>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        <ul className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={showLabels ? undefined : item.label}
                  title={showLabels ? undefined : item.label}
                  className={cn(
                    'group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                    active ? 'bg-court-800 text-white' : 'text-court-200 hover:bg-court-900 hover:text-white',
                    !showLabels && 'lg:justify-center lg:px-0',
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-signal-500" />}
                  <Icon className={cn('size-5 shrink-0', active ? 'text-signal-300' : 'text-court-300 group-hover:text-white')} />
                  {showLabels && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default AdminSidebar;
