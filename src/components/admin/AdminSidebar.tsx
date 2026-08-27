import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { menuItems } from './menu';

interface AdminSidebarProps {
  userRole?: string;
}

/** Collapsible icon-rail sidebar, ported from TailAdmin's AppSidebar.tsx onto react-router. */
const AdminSidebar: React.FC<AdminSidebarProps> = ({ userRole }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  const visibleItems = menuItems.filter(
    (item) => !item.roles || (userRole !== undefined && item.roles.includes(userRole)),
  );

  const showLabels = isExpanded || isHovered || isMobileOpen;
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? 'w-[290px]' : isHovered ? 'w-[290px]' : 'w-[90px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${showLabels ? 'justify-start' : 'lg:justify-center'}`}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="OptiqSports" className="h-8 w-8 shrink-0" />
          {showLabels && <span className="text-lg font-semibold text-gray-800 dark:text-white">OptiqSports</span>}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <ul className="flex flex-col gap-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.key}>
                  <Link
                    to={item.href}
                    className={`menu-item group ${active ? 'menu-item-active' : 'menu-item-inactive'} ${
                      showLabels ? '' : 'lg:justify-center'
                    }`}
                  >
                    <span className={active ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}>
                      <Icon className="size-5" />
                    </span>
                    {showLabels && <span className="menu-item-text">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default AdminSidebar;
