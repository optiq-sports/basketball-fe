import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlusCircle, FiLogOut, FiUsers } from 'react-icons/fi'
import { MdSportsBasketball, MdLeaderboard, MdGroup } from 'react-icons/md'
import { IoStatsChart } from 'react-icons/io5'
import { HiUsers } from 'react-icons/hi'
import { BiHome } from 'react-icons/bi'

interface SidebarProps {
  activeItem?: string;
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem = '', onNavigate }) => {
  const navigate = useNavigate();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BiHome className="text-xl" />,
      path: '/dashboard',
    },
    {
      id: 'start-new',
      label: 'Start New',
      icon: <FiPlusCircle className="text-xl" />,
      path: '/start-new',
    },
    {
      id: 'tournaments',
      label: 'Tournaments',
      icon: <MdSportsBasketball className="text-xl" />,
      path: '/tournaments',
    },
    {
      id: 'results',
      label: 'Results',
      icon: <MdLeaderboard className="text-xl" />,
      path: '/results',
    },
    {
      id: 'statisticians',
      label: 'Statisticians',
      icon: <HiUsers className="text-xl" />,
      path: '/statisticians',
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: <MdGroup className="text-xl" />,
      path: '/teams-management',
    },
    {
      id: 'players',
      label: 'Players',
      icon: <FiUsers className="text-xl" />,
      path: '/players-management',
    },
    {
      id: 'users',
      label: 'Users',
      icon: <HiUsers className="text-xl" />,
      path: '/users',
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onNavigate) {
      onNavigate(); // Close sidebar on mobile after navigation
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUser');
    navigate('/login');
    if (onNavigate) {
      onNavigate(); // Close sidebar on mobile after logout
    }
  };

  return (
    <div className="w-60 h-full bg-[#F8F8F8] border-r border-gray-200 flex flex-col">
      {/* Menu Items */}
      <div className="flex-1 py-6 px-3">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeItem === item.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={activeItem === item.id ? 'text-blue-600' : 'text-gray-500'}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Logout Button */}
      <div className="px-3 py-6 border-t border-gray-200">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 transition-all"
        >
          <FiLogOut className="text-xl" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
