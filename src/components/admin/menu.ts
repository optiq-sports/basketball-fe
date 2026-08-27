import type { ComponentType } from 'react';
import { LuTrophy, LuShieldCheck } from 'react-icons/lu';
import { GridIcon, PlusIcon, PieChartIcon, TaskIcon, GroupIcon, UserCircleIcon, BoxCubeIcon } from './icons';

export interface MenuItem {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Only shown when the current user's role is in this list. Omit for "everyone". */
  roles?: string[];
}

export const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: GridIcon },
  { key: 'start-new', label: 'Start New', href: '/start-new', icon: PlusIcon },
  { key: 'tournaments', label: 'Tournaments', href: '/tournaments', icon: LuTrophy },
  { key: 'results', label: 'Results', href: '/results', icon: PieChartIcon },
  { key: 'statisticians', label: 'Statisticians', href: '/statisticians', icon: TaskIcon },
  { key: 'teams', label: 'Teams', href: '/teams-management', icon: GroupIcon },
  { key: 'players', label: 'Players', href: '/players-management', icon: UserCircleIcon },
  { key: 'users', label: 'Users', href: '/users', icon: LuShieldCheck, roles: ['SUPER_ADMIN'] },
  { key: 'ops', label: 'Queue Ops', href: '/ops/queues', icon: BoxCubeIcon, roles: ['SUPER_ADMIN'] },
];
