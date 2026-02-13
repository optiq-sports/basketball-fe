import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiMapPin, FiEdit2, FiTrash } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import {
  useStatisticians,
  useCreateStatistician,
  useUpdateStatistician,
  useDeleteStatistician,
} from '../../api/hooks';
import type { Statistician as ApiStatistician } from '../../types/api';

interface StatisticianDisplay {
  id: string;
  name: string;
  surname: string;
  location: string;
  image: string;
  email: string;
  status: string;
}

const Statisticians: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStatistician, setEditingStatistician] = useState<StatisticianDisplay | null>(null);
  const itemsPerPage = 9;

  const statisticiansQuery = useStatisticians();
  const createStatistician = useCreateStatistician();
  const updateStatistician = useUpdateStatistician();
  const deleteStatistician = useDeleteStatistician();

  const statisticians = useMemo(() => {
    return (statisticiansQuery.data ?? []).map((s: ApiStatistician): StatisticianDisplay => {
      const firstName = s.firstName ?? s.name ?? '';
      const lastName = s.lastName ?? '';
      const name = firstName && lastName ? firstName : (s.name ?? s.email ?? '');
      const surname = lastName || (name ? '' : (s.email ?? ''));
      const loc = [s.state, s.country].filter(Boolean).join(', ') || '—';
      return {
        id: s.id,
        name: name || '—',
        surname: surname || '',
        location: loc,
        image: (s.image as string) ?? '/stat.png',
        email: s.email ?? '',
        status: (s.status as string) ?? 'ACTIVE',
      };
    });
  }, [statisticiansQuery.data]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    country: '',
    state: '',
    homeAddress: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const filteredStatisticians = useMemo(() => {
    let filtered = statisticians;
    if (filter !== 'All') {
      filtered = filtered.filter((s) => s.status === filter.toUpperCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.surname.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [searchQuery, filter, statisticians]);

  const totalPages = Math.max(1, Math.ceil(filteredStatisticians.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStatisticians = filteredStatisticians.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const handleAddStatistician = () => {
    setEditingStatistician(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      country: '',
      state: '',
      homeAddress: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleEditStatistician = (s: StatisticianDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStatistician(s);
    const apiStat = (statisticiansQuery.data ?? []).find((x) => x.id === s.id) as ApiStatistician | undefined;
    setFormData({
      firstName: apiStat?.firstName ?? s.name,
      lastName: apiStat?.lastName ?? s.surname,
      email: s.email,
      password: '',
      phone: (apiStat?.phone as string) ?? '',
      country: (apiStat?.country as string) ?? '',
      state: (apiStat?.state as string) ?? '',
      homeAddress: (apiStat?.homeAddress as string) ?? '',
      status: (apiStat?.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleDeleteStatistician = (s: StatisticianDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${s.name} ${s.surname}? This cannot be undone.`)) {
      deleteStatistician.mutate(s.id, { onError: (err) => alert(err.message) });
    }
  };

  const handleSaveStatistician = () => {
    if (!formData.email?.trim()) {
      alert('Email is required');
      return;
    }
    if (editingStatistician) {
      updateStatistician.mutate(
        {
          id: editingStatistician.id,
          data: {
            firstName: formData.firstName || undefined,
            lastName: formData.lastName || undefined,
            status: formData.status,
            phone: formData.phone || undefined,
            country: formData.country || undefined,
            state: formData.state || undefined,
            homeAddress: formData.homeAddress || undefined,
          },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingStatistician(null);
            resetForm();
          },
          onError: (e) => alert(e.message),
        }
      );
    } else {
      if (!formData.password?.trim()) {
        alert('Password is required for new statistician');
        return;
      }
      createStatistician.mutate(
        {
          email: formData.email.trim(),
          password: formData.password,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
          status: formData.status,
          phone: formData.phone || undefined,
          country: formData.country || undefined,
          state: formData.state || undefined,
          homeAddress: formData.homeAddress || undefined,
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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      country: '',
      state: '',
      homeAddress: '',
      status: 'ACTIVE',
    });
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Statisticians</h1>
      </div>

      {statisticiansQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {statisticiansQuery.error.message}
        </div>
      )}

      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleAddStatistician}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
        >
          Add Statistician
        </button>
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search Statistician"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[140px]"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
      </div>

      {statisticiansQuery.isPending ? (
        <div className="py-12 text-center text-gray-500">Loading statisticians...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {paginatedStatisticians.length > 0 ? (
              paginatedStatisticians.map((statistician) => (
                <div
                  key={statistician.id}
                  onClick={() => navigate(`/statisticians/${statistician.id}`)}
                  className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer relative group"
                >
                  <div className="w-full h-40 bg-gray-200 relative overflow-hidden">
                    <img
                      src={statistician.image}
                      alt={`${statistician.name} ${statistician.surname}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditStatistician(statistician, e)}
                        className="p-2 bg-white/90 text-blue-600 rounded-lg hover:bg-white shadow"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteStatistician(statistician, e)}
                        className="p-2 bg-white/90 text-red-600 rounded-lg hover:bg-white shadow"
                        title="Delete"
                      >
                        <FiTrash size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {statistician.name} {statistician.surname}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <FiMapPin size={16} />
                      <span>{statistician.location}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 text-lg">No statisticians found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingStatistician ? 'Edit Statistician' : 'Add Statistician'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingStatistician(null); resetForm(); }} className="text-gray-600 hover:text-gray-900">
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingStatistician}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              {!editingStatistician && (
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Home Address</label>
                <input
                  type="text"
                  placeholder="Street address"
                  value={formData.homeAddress}
                  onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => { setIsModalOpen(false); setEditingStatistician(null); resetForm(); }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStatistician}
                disabled={createStatistician.isPending || updateStatistician.isPending}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70"
              >
                {createStatistician.isPending || updateStatistician.isPending ? 'Saving...' : editingStatistician ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statisticians;
