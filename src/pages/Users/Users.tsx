import React, { useState, useMemo } from 'react';
import { FiSearch, FiEdit2, FiTrash } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import {
  useAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useDeleteAdmin,
  useProfile,
} from '../../api/hooks';
import type { Admin as ApiAdmin } from '../../types/api';

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

const Users: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDisplay | null>(null);
  const itemsPerPage = 10;

  const adminsQuery = useAdmins();
  const profileQuery = useProfile();
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [searchQuery, roleFilter, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, statusFilter, searchQuery]);

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
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

  const handleDeleteUser = (u: UserDisplay) => {
    if (u.email === profileData?.email) {
      alert('You cannot delete your own account.');
      return;
    }
    if (window.confirm(`Delete user ${u.email}? This cannot be undone.`)) {
      deleteAdmin.mutate(u.id, { onError: (err) => alert(err.message) });
    }
  };

  const handleSaveUser = () => {
    if (!formData.email?.trim()) {
      alert('Email is required');
      return;
    }
    if (editingUser) {
      updateAdmin.mutate(
        {
          id: editingUser.id,
          data: { name: formData.name || undefined, status: formData.status },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingUser(null);
            resetForm();
          },
          onError: (e) => alert(e.message),
        }
      );
    } else {
      if (!formData.password?.trim()) {
        alert('Password is required for new user');
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
          onError: (e) => alert(e.message),
        }
      );
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Users</h1>
        {profileData && (
          <p className="text-sm text-gray-600">
            Logged in as: <strong>{profileData.email}</strong> ({profileData.role})
          </p>
        )}
      </div>

      {adminsQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {adminsQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddUser}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
        >
          Add User
        </button>
        <div className="relative" style={{ width: '220px', minWidth: '180px' }}>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by email or name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
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
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[120px]"
        >
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {adminsQuery.isPending ? (
        <div className="py-12 text-center text-gray-500">Loading users...</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F5F8FF' }}>
                  <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">EMAIL</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">NAME</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">ROLE</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">STATUS</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-700">{user.email}</td>
                      <td className="py-3 px-4 text-sm font-medium text-blue-900">{user.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{formatRole(user.role)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{user.status}</td>
                      <td className="text-center py-3 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                            disabled={user.email === profileData?.email}
                          >
                            <FiTrash size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <p className="text-gray-500 text-lg">No users found</p>
                      <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-medium ${
                  currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    currentPage === page ? 'bg-blue-900 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg font-medium ${
                  currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingUser(null); resetForm(); }} className="text-gray-600 hover:text-gray-900">
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => { setIsModalOpen(false); setEditingUser(null); resetForm(); }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={createAdmin.isPending || updateAdmin.isPending}
                className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70"
              >
                {createAdmin.isPending || updateAdmin.isPending ? 'Saving...' : editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
