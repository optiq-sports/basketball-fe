import React, { useState, useMemo, useEffect } from 'react';
import { FiSearch, FiFilter, FiChevronDown, FiEdit2, FiTrash } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  status: 'active' | 'inactive';
  createdAt: string;
}

const Users: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'super_admin' | 'admin' | null>(null);
  const itemsPerPage = 10;

  // Get current user role from localStorage
  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'super_admin' | 'admin' | null;
    setCurrentUserRole(role);
  }, []);

  const [users, setUsers] = useState<User[]>([
    {
      id: 1,
      name: 'Super Admin',
      email: 'superadmin@optiqsports.com',
      role: 'super_admin',
      status: 'active',
      createdAt: '2024-01-15',
    },
    {
      id: 2,
      name: 'Admin User',
      email: 'admin@optiqsports.com',
      role: 'admin',
      status: 'active',
      createdAt: '2024-02-20',
    },
    {
      id: 3,
      name: 'John Smith',
      email: 'john.smith@optiqsports.com',
      role: 'admin',
      status: 'active',
      createdAt: '2024-03-10',
    },
    {
      id: 4,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@optiqsports.com',
      role: 'admin',
      status: 'active',
      createdAt: '2024-03-15',
    },
    {
      id: 5,
      name: 'Mike Williams',
      email: 'mike.williams@optiqsports.com',
      role: 'admin',
      status: 'inactive',
      createdAt: '2024-04-01',
    },
    {
      id: 6,
      name: 'Emily Davis',
      email: 'emily.davis@optiqsports.com',
      role: 'admin',
      status: 'active',
      createdAt: '2024-04-05',
    },
    {
      id: 7,
      name: 'David Brown',
      email: 'david.brown@optiqsports.com',
      role: 'super_admin',
      status: 'active',
      createdAt: '2024-04-10',
    },
    {
      id: 8,
      name: 'Lisa Anderson',
      email: 'lisa.anderson@optiqsports.com',
      role: 'admin',
      status: 'active',
      createdAt: '2024-04-12',
    },
  ]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as 'super_admin' | 'admin',
    status: 'active' as 'active' | 'inactive',
  });

  // Filter users by search query and role
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filter by role
    if (filter === 'Super Admin' || filter === 'Admin') {
      filtered = filtered.filter(user => {
        if (filter === 'Super Admin') return user.role === 'super_admin';
        if (filter === 'Admin') return user.role === 'admin';
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, filter, users]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    // Get current user ID from localStorage
    const currentUserStr = localStorage.getItem('currentUser');
    let currentUserId: number | null = null;
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        currentUserId = currentUser.id;
      } catch (e) {
        console.error('Error parsing current user:', e);
      }
    }

    // Prevent deleting current user
    if (user.id === currentUserId) {
      alert('You cannot delete your own account');
      return;
    }

    // Check permissions
    if (currentUserRole !== 'super_admin' && user.role === 'super_admin') {
      alert('You do not have permission to delete super admins');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      setUsers(users.filter(u => u.id !== user.id));
      alert('User deleted successfully!');
    }
  };

  const handleSaveUser = () => {
    // Validation
    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('Password is required for new users');
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    // Check for duplicate email (excluding current user if editing)
    const emailExists = users.some(u => 
      u.email.toLowerCase() === formData.email.toLowerCase() && 
      (!editingUser || u.id !== editingUser.id)
    );
    if (emailExists) {
      alert('A user with this email already exists');
      return;
    }

    // Check permissions for role assignment
    if (currentUserRole === 'admin' && formData.role === 'super_admin') {
      alert('You do not have permission to create or edit super admins');
      return;
    }

    // Get current user ID from localStorage
    const currentUserStr = localStorage.getItem('currentUser');
    let currentUserId: number | null = null;
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        currentUserId = currentUser.id;
      } catch (e) {
        console.error('Error parsing current user:', e);
      }
    }

    if (editingUser) {
      // Prevent editing current user's role to prevent lockout
      if (editingUser.id === currentUserId && formData.role !== editingUser.role) {
        alert('You cannot change your own role');
        return;
      }

      // Update existing user
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { 
              ...u, 
              name: formData.name,
              email: formData.email,
              role: formData.role,
              status: formData.status
            }
          : u
      ));
      
      // If editing current user, update localStorage
      if (editingUser.id === currentUserId) {
        const updatedUser = {
          id: editingUser.id,
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        localStorage.setItem('userRole', formData.role);
      }
    } else {
      // Add new user
      const newUser: User = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setUsers([...users, newUser]);
    }

    // Show success message
    alert(editingUser ? 'User updated successfully!' : 'User created successfully!');

    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      status: 'active',
    });
  };

  const handleRoleChange = (userId: number, newRole: 'super_admin' | 'admin') => {
    // Get current user ID from localStorage
    const currentUserStr = localStorage.getItem('currentUser');
    let currentUserId: number | null = null;
    if (currentUserStr) {
      try {
        const currentUser = JSON.parse(currentUserStr);
        currentUserId = currentUser.id;
      } catch (e) {
        console.error('Error parsing current user:', e);
      }
    }

    // Prevent changing current user's role
    if (userId === currentUserId) {
      alert('You cannot change your own role');
      // Reset the select to original value
      const user = users.find(u => u.id === userId);
      if (user) {
        const selectElement = document.querySelector(`select[value="${user.role}"]`) as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = user.role;
        }
      }
      return;
    }

    // Check permissions
    if (currentUserRole === 'admin') {
      const user = users.find(u => u.id === userId);
      if (user?.role === 'super_admin' || newRole === 'super_admin') {
        alert('You do not have permission to change super admin roles');
        // Reset the select to original value
        if (user) {
          const selectElement = document.querySelector(`select[value="${user.role}"]`) as HTMLSelectElement;
          if (selectElement) {
            selectElement.value = user.role;
          }
        }
        return;
      }
    }

    setUsers(users.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    ));
    
    alert('User role updated successfully!');
  };

  const canEditUser = (user: User) => {
    if (currentUserRole === 'super_admin') return true;
    if (currentUserRole === 'admin' && user.role === 'admin') return true;
    return false;
  };

  const canDeleteUser = (user: User) => {
    if (currentUserRole === 'super_admin') return true;
    if (currentUserRole === 'admin' && user.role === 'admin') return true;
    return false;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Users</h1>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 mb-8">
        {/* Add User Button - Only visible to super admin and admin */}
        {(currentUserRole === 'super_admin' || currentUserRole === 'admin') && (
          <button 
            onClick={handleAddUser}
            className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Add User
          </button>
        )}

        {/* Search Bar */}
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search User"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Dropdown */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
          >
            <option value="All">All Roles</option>
            <option value="Super Admin">Super Admin</option>
            <option value="Admin">Admin</option>
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F5F8FF' }}>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">USER</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">EMAIL</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">ROLE</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">STATUS</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user, index) => (
                <tr 
                  key={user.id}
                  className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {getInitials(user.name)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">Joined {user.createdAt}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{user.email}</td>
                  <td className="py-3 px-4">
                    {(currentUserRole === 'super_admin' || (currentUserRole === 'admin' && user.role === 'admin')) ? (
                      <select
                        key={`role-${user.id}-${user.role}`}
                        value={user.role}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRoleChange(user.id, e.target.value as 'super_admin' | 'admin');
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="admin">Admin</option>
                        {currentUserRole === 'super_admin' && (
                          <option value="super_admin">Super Admin</option>
                        )}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-700 capitalize">
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Get current user ID from localStorage
                        const currentUserStr = localStorage.getItem('currentUser');
                        let currentUserId: number | null = null;
                        if (currentUserStr) {
                          try {
                            const currentUser = JSON.parse(currentUserStr);
                            currentUserId = currentUser.id;
                          } catch (e) {
                            console.error('Error parsing current user:', e);
                          }
                        }

                        // Prevent changing current user's status
                        if (user.id === currentUserId) {
                          alert('You cannot change your own status');
                          return;
                        }

                        setUsers(users.map(u => 
                          u.id === user.id 
                            ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
                            : u
                        ));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        user.status === 'active' 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {canEditUser(user) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditUser(user);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <FiEdit2 size={18} />
                        </button>
                      )}
                      {canDeleteUser(user) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(user);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <FiTrash size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <p className="text-gray-500 text-lg">No users found</p>
                  <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Previous
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === page
                  ? 'bg-blue-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUser(null);
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'admin',
                    status: 'active',
                  });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <MdCancel size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Password - Only for new users */}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'super_admin' | 'admin' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={currentUserRole === 'admin'}
                  >
                    <option value="admin">Admin</option>
                    {currentUserRole === 'super_admin' && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                  {currentUserRole === 'admin' && (
                    <p className="text-xs text-gray-500 mt-1">You can only create admin users</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingUser(null);
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: 'admin',
                    status: 'active',
                  });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
              >
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
