import React, { useState, useMemo } from 'react';
import { FiSearch, FiEdit2, FiTrash, FiCopy } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useDeleteAdmin,
  useProfile,
} from '../../api/hooks';
import type { Admin as ApiAdmin } from '../../types/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Administrator' },
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'STATISTICIAN', label: 'Statistician' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

interface UserDisplay {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

function formatRole(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let result = '';
  result += upper[Math.floor(Math.random() * upper.length)];
  result += lower[Math.floor(Math.random() * lower.length)];
  result += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < length; i++) {
    result += all[Math.floor(Math.random() * all.length)];
  }
  return result.split('').sort(() => Math.random() - 0.5).join('');
}

const Users: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplay | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const adminsQuery = useAdmins();
  const profileQuery = useProfile();
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();

  const profileData = profileQuery.data as { email?: string; role?: string } | undefined;

  const users = useMemo(() => {
    return (adminsQuery.data ?? []).map((a: ApiAdmin): UserDisplay => ({
      id: a.id,
      email: a.email ?? '',
      name: (a.name as string) ?? '—',
      role: (a.role as string) ?? '—',
      status: (a.status as string) ?? 'ACTIVE',
    }));
  }, [adminsQuery.data]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'ADMIN' as 'SUPER_ADMIN' | 'ADMIN' | 'STATISTICIAN',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const filteredUsers = useMemo(() => {
    let filtered = users;
    if (roleFilter !== 'All') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== 'All') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [debouncedSearchQuery, roleFilter, statusFilter, users]);

  const handleAddUser = () => {
    setEditingUser(null);
    const generatedPassword = generatePassword();
    setFormData({
      email: '',
      password: generatedPassword,
      name: '',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleEditUser = (u: UserDisplay) => {
    setEditingUser(u);
    const apiAdmin = (adminsQuery.data ?? []).find((x) => x.id === u.id) as ApiAdmin | undefined;
    setFormData({
      email: u.email,
      password: '',
      name: u.name === '—' ? '' : u.name,
      role: (apiAdmin?.role as 'SUPER_ADMIN' | 'ADMIN' | 'STATISTICIAN') ?? 'ADMIN',
      status: (apiAdmin?.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (u: UserDisplay) => {
    if (u.email === profileData?.email) {
      toast.error('You cannot delete your own account.');
      return;
    }
    const ok = await confirm({
      description: `Delete user ${u.email}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      deleteAdmin.mutate(u.id, { onError: (err) => toast.error(err.message) });
    }
  };

  const handleSaveUser = () => {
    if (!formData.email?.trim()) {
      toast.error('Email is required');
      return;
    }
    if (editingUser) {
      const updateData: import('../../types/api').AdminUpdateBody = {
        name: formData.name || undefined,
        status: formData.status,
        role: formData.role,
      };
      if (formData.password?.trim()) {
        updateData.password = formData.password.trim();
      }
      updateAdmin.mutate(
        {
          id: editingUser.id,
          data: updateData,
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingUser(null);
            resetForm();
          },
          onError: (e) => toast.error(e.message),
        }
      );
    } else {
      if (!formData.password?.trim()) {
        toast.error('Password is required for new user');
        return;
      }
      createAdmin.mutate(
        {
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name || undefined,
          role: formData.role,
          status: formData.status,
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            resetForm();
          },
          onError: (e) => toast.error(e.message),
        }
      );
    }
  };

  const resetForm = () => {
    setPasswordCopied(false);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  };

  const columns = useMemo<ColumnDef<UserDisplay>[]>(
    () => [
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => formatRole(row.original.role),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            tone={row.original.status === 'ACTIVE' ? 'success' : 'neutral'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original;
          const isSelf = user.email === profileData?.email;
          return (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleEditUser(user)}
                className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg dark:text-brand-400 dark:hover:bg-brand-500/10"
                title="Edit"
              >
                <FiEdit2 size={18} />
              </button>
              <button
                onClick={() => handleDeleteUser(user)}
                className="p-2 text-error-600 hover:bg-error-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed dark:text-error-500 dark:hover:bg-error-500/10"
                title="Delete"
                disabled={isSelf}
              >
                <FiTrash size={18} />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileData?.email],
  );

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Users</h1>
        {profileData && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Logged in as: <strong>{profileData.email}</strong> ({profileData.role})
          </p>
        )}
      </div>

      {adminsQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-error-50 border border-error-100 text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
          {adminsQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddUser}
          className="px-6 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
        >
          Add User
        </button>
        <div className="relative" style={{ width: '220px', minWidth: '180px' }}>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search by email or name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 min-w-[140px] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="All">All Roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 min-w-[120px] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={adminsQuery.isPending}
        error={adminsQuery.error ? (adminsQuery.error as Error).message || 'Failed to load users.' : null}
        onRetry={() => adminsQuery.refetch()}
        emptyMessage="No users found. Try adjusting your search or filters."
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-lg dark:bg-gray-900">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingUser(null); resetForm(); }} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Email *</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  {editingUser ? 'New password (leave blank to keep current)' : 'Password *'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={editingUser ? 'Leave blank to keep current' : '••••••••'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm font-medium whitespace-nowrap dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                    title="Generate password"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.password) {
                        navigator.clipboard.writeText(formData.password);
                        setPasswordCopied(true);
                        window.setTimeout(() => setPasswordCopied(false), 2000);
                      }
                    }}
                    disabled={!formData.password}
                    className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                    title="Copy password"
                  >
                    <FiCopy size={18} />
                  </button>
                </div>
                {passwordCopied && (
                  <p className="text-xs text-success-600 dark:text-success-500 mt-1">Password copied to clipboard</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => { setIsModalOpen(false); setEditingUser(null); resetForm(); }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={createAdmin.isPending || updateAdmin.isPending}
                className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70"
              >
                {createAdmin.isPending || updateAdmin.isPending ? 'Saving...' : editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default Users;
