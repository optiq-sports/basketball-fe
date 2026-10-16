import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { menuItems } from './menu';
import { cn } from '../../lib/utils';

interface AdminSidebarProps {
  userRole?: string;
}

/**
 * The collapsible sidebar, back to its pre-redesign light rail: white (dark grey in dark mode) with a
 * right border, `brand`-tinted active item, and the `menu-item` utilities from `assets/admin/menu.css`.
 * The redesign had made it a navy `court-950` rail with signal accents.
 *
 * It collapses to icons on desktop, expands on hover, and slides in as a drawer on mobile. Items are
 * filtered by role for presentation only; the API enforces access.
 *
 * The accessibility the redesign added stays: a labelled `nav`, `aria-current="page"` on the active
 * item, and an `aria-label`/`title` on each item while the rail is collapsed to icons — without which
 * the collapsed rail is a column of unlabelled pictures.
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
        'fixed top-0 left-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:mt-0 dark:border-gray-800 dark:bg-gray-900',
        wide ? 'w-[290px]' : 'w-[90px]',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('flex py-8', showLabels ? 'justify-start' : 'lg:justify-center')}>
        <Link to="/dashboard" className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <img src="/logo.png" alt="OptiqSports" className="size-8 shrink-0" />
          {showLabels && <span className="text-lg font-semibold text-gray-800 dark:text-white">OptiqSports</span>}
        </Link>
      </div>

      <nav aria-label="Main navigation" className="no-scrollbar mb-6 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-3">
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
                    'menu-item group outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    active ? 'menu-item-active' : 'menu-item-inactive',
                    !showLabels && 'lg:justify-center',
                  )}
                >
                  <span className={active ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}>
                    <Icon className="size-5 shrink-0" />
                  </span>
                  {showLabels && <span className="menu-item-text truncate">{item.label}</span>}
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
