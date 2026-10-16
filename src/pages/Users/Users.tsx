import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiEdit2, FiSlash, FiRotateCcw, FiCopy, FiCheck } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdmins, useCreateAdmin, useDeleteAdmin, useProfile, useUpdateAdmin } from '../../api/hooks';
import type { Admin } from '../../types/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useToast } from '../../hooks/useToast';
import {
  EMPTY_ADMIN_FORM,
  ROLES,
  fromAdmin,
  roleLabel,
  toCreatePayload,
  toUpdatePayload,
  validateAdminForm,
  type AdminFormErrors,
  type AdminFormValues,
} from '../../components/admins/admin-form';
import { isSelf, lockReason, type Me } from '../../components/admins/admin-rules';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

const labelOf = (a: Admin) => a.name?.trim() || a.email;

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5';
const filterClass =
  'px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let result = '';
  result += upper[Math.floor(Math.random() * upper.length)];
  result += lower[Math.floor(Math.random() * lower.length)];
  result += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < length; i++) result += all[Math.floor(Math.random() * all.length)];
  return result
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Admins and super admins. The page is back to its pre-redesign layout — full-bleed white panel, large
 * title, `brand`-toned controls, icon actions and the inline modal — while every behaviour added since
 * stays in place:
 *
 * - **Deactivate, not delete.** `DELETE /admin/:id` only sets the status to INACTIVE, so the action says
 *   so, and an inactive admin can be reactivated. The old page said "Delete … This cannot be undone",
 *   which was never true.
 * - **Lockout guards (Gap 41).** The backend will happily let you deactivate or demote yourself or the
 *   last active super admin, which would lock everyone out of this SUPER_ADMIN-only page.
 *   `admin-rules.lockReason` blocks both here and explains why.
 * - **Zod validation** through `admin-form`, and updates that send only what changed.
 * - **Filters live in the URL**, so a filtered view can be linked and survives the back button.
 *
 * Role, status and search filter the full list in the browser: the backend now accepts `search` on
 * `GET /admin` (Gap 39, resolved), but the list is short and this costs nothing.
 */
const Users: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const role = ROLES.find((r) => r.value === params.get('role'))?.value ?? '';
  const status = params.get('status') === 'active' ? 'ACTIVE' : params.get('status') === 'inactive' ? 'INACTIVE' : '';
  const q = params.get('q') ?? '';

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState(q);
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  useEffect(() => setSearchQuery(q), [q]);
  useEffect(() => {
    if (debouncedSearch.trim() === q) return;
    setParam({ q: debouncedSearch.trim() || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const adminsQuery = useAdmins();
  const profileQuery = useProfile();
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deactivateAdmin = useDeleteAdmin();

  const profileData = profileQuery.data;
  const me: Me | undefined = profileData ? { id: profileData.id, email: profileData.email } : undefined;
  const all: Admin[] = useMemo(() => adminsQuery.data ?? [], [adminsQuery.data]);

  const filteredUsers = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return all.filter(
      (a) =>
        (!role || a.role === role) &&
        (!status || (a.status ?? 'ACTIVE') === status) &&
        (!needle ||
          (a.name ?? '').toLowerCase().includes(needle) ||
          a.email.toLowerCase().includes(needle) ||
          roleLabel(a.role).toLowerCase().includes(needle)),
    );
  }, [all, role, status, debouncedSearch]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormValues>(EMPTY_ADMIN_FORM);
  const [baseline, setBaseline] = useState<AdminFormValues>(EMPTY_ADMIN_FORM);
  const [errors, setErrors] = useState<AdminFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const editingLock = editingUser ? lockReason(editingUser, all, me) : null;

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData(EMPTY_ADMIN_FORM);
    setBaseline(EMPTY_ADMIN_FORM);
    setErrors({});
    setServerError(null);
    setPasswordCopied(false);
  };

  const handleAddUser = () => {
    // Left blank on purpose: the backend generates and emails a temporary password when none is sent.
    // "Generate" is there for an admin who would rather set one and hand it over directly (Gap 49 —
    // welcome mail isn't reliably delivered).
    setEditingUser(null);
    setFormData(EMPTY_ADMIN_FORM);
    setBaseline(EMPTY_ADMIN_FORM);
    setErrors({});
    setServerError(null);
    setPasswordCopied(false);
    setIsModalOpen(true);
  };

  const handleEditUser = (a: Admin) => {
    const values = fromAdmin(a);
    setEditingUser(a);
    setFormData(values);
    setBaseline(values);
    setErrors({});
    setServerError(null);
    setPasswordCopied(false);
    setIsModalOpen(true);
  };

  const handleSaveUser = () => {
    const editing = !!editingUser;
    const found = validateAdminForm(formData, editing);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setServerError(null);

    if (editingUser) {
      const body = toUpdatePayload(formData, baseline, !!editingLock);
      if (Object.keys(body).length === 0) {
        closeModal();
        return;
      }
      const who = editingUser;
      updateAdmin.mutate(
        { id: who.id, data: body },
        {
          onSuccess: () => {
            toast.success(`${labelOf(who)} saved.`);
            closeModal();
          },
          onError: (e) => setServerError(e.message),
        },
      );
      return;
    }

    const body = toCreatePayload(formData);
    createAdmin.mutate(body, {
      onSuccess: (created) => {
        toast.success(
          body.password
            ? `${labelOf(created)} added.`
            : `${labelOf(created)} added. The server was asked to email them a temporary password. If it doesn’t arrive, set one from Edit.`,
        );
        closeModal();
      },
      onError: (e) => setServerError(e.message),
    });
  };

  const handleDeactivate = async (a: Admin) => {
    const locked = lockReason(a, all, me);
    if (locked) {
      toast.error(locked);
      return;
    }
    const label = labelOf(a);
    const ok = await confirm({
      title: 'Deactivate this admin?',
      description: `${label} will be signed out and won’t be able to reach the admin area. Their account is kept and you can reactivate it at any time.`,
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });
    if (!ok) return;
    deactivateAdmin.mutate(a.id, {
      onSuccess: () => toast.success(`${label} deactivated.`),
      onError: (e) => toast.error(`Couldn’t deactivate ${label}: ${e.message}`),
    });
  };

  const handleReactivate = (a: Admin) => {
    setReactivatingId(a.id);
    updateAdmin.mutate(
      { id: a.id, data: { status: 'ACTIVE' } },
      {
        onSuccess: () => toast.success(`${labelOf(a)} reactivated.`),
        onError: (e) => toast.error(`Couldn’t reactivate ${labelOf(a)}: ${e.message}`),
        onSettled: () => setReactivatingId(null),
      },
    );
  };

  const columns = useMemo<ColumnDef<Admin>[]>(
    () => [
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.name?.trim() || '—'}
            {isSelf(row.original, me) && <span className="ml-2 text-xs font-normal text-brand-600 dark:text-brand-400">(you)</span>}
          </span>
        ),
      },
      { accessorKey: 'role', header: 'Role', cell: ({ row }) => roleLabel(row.original.role) },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.status === 'INACTIVE' ? 'Inactive' : 'Active'}
            tone={row.original.status === 'INACTIVE' ? 'neutral' : 'success'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original;
          const locked = lockReason(a, all, me);
          const label = labelOf(a);
          const inactive = a.status === 'INACTIVE';
          return (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleEditUser(a)}
                className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg dark:text-brand-400 dark:hover:bg-brand-500/10"
                title="Edit"
                aria-label={`Edit ${label}`}
              >
                <FiEdit2 size={18} />
              </button>
              {inactive ? (
                <button
                  onClick={() => handleReactivate(a)}
                  disabled={reactivatingId === a.id}
                  className="p-2 text-success-600 hover:bg-success-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed dark:text-success-500 dark:hover:bg-success-500/10"
                  title="Reactivate"
                  aria-label={`Reactivate ${label}`}
                >
                  <FiRotateCcw size={18} />
                </button>
              ) : (
                <button
                  onClick={() => void handleDeactivate(a)}
                  disabled={!!locked}
                  className="p-2 text-error-600 hover:bg-error-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed dark:text-error-500 dark:hover:bg-error-500/10"
                  title={locked ?? 'Deactivate'}
                  aria-label={`Deactivate ${label}`}
                >
                  <FiSlash size={18} />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // handleEditUser/handleDeactivate/handleReactivate read stable setters; their data is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, me?.id, me?.email, reactivatingId],
  );

  const isSaving = createAdmin.isPending || updateAdmin.isPending;

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Users</h1>
        {profileData && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Logged in as: <strong>{profileData.email}</strong> ({roleLabel(profileData.role)})
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddUser}
          className="px-6 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
        >
          Add User
        </button>
        <div className="relative" style={{ width: '220px', minWidth: '180px' }}>
          <label htmlFor="admin-search" className="sr-only">
            Search admins
          </label>
          <FiSearch
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
            size={20}
          />
          <input
            id="admin-search"
            type="text"
            placeholder="Search by email or name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <label htmlFor="admin-role" className="sr-only">
          Filter by role
        </label>
        <select
          id="admin-role"
          value={role}
          onChange={(e) => setParam({ role: e.target.value })}
          className={`${filterClass} min-w-[140px]`}
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <label htmlFor="admin-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="admin-status"
          value={status}
          onChange={(e) => setParam({ status: e.target.value ? e.target.value.toLowerCase() : null })}
          className={`${filterClass} min-w-[120px]`}
        >
          <option value="">All Status</option>
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
        error={adminsQuery.isError ? (adminsQuery.error as Error).message || 'Failed to load users.' : null}
        onRetry={() => void adminsQuery.refetch()}
        emptyMessage="No users found. Try adjusting your search or filters."
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          {/* The old page used a bare div here. The look is kept, but it is a labelled dialog now:
              screen readers announced nothing before, which is a defect rather than a style. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-title"
            className="bg-white rounded-lg w-full max-w-md shadow-lg dark:bg-gray-900"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 id="admin-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-label="Close"
              >
                <MdCancel size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {serverError && (
                <p className="px-4 py-3 rounded-lg bg-error-50 border border-error-100 text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
                  {serverError}
                </p>
              )}

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Email *
                </label>
                <input
                  id="admin-email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  aria-invalid={!!errors.email}
                  className={inputClass}
                />
                {errors.email && <p className="mt-1 text-sm text-error-600 dark:text-error-500">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  {editingUser ? 'New password (leave blank to keep current)' : 'Password (leave blank to email one)'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="admin-password"
                    type="text"
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Leave blank to email a temporary one'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    aria-invalid={!!errors.password}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, password: generatePassword() });
                      setPasswordCopied(false);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm font-medium whitespace-nowrap dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                    title="Generate password"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.password) return;
                      void navigator.clipboard?.writeText(formData.password);
                      setPasswordCopied(true);
                      window.setTimeout(() => setPasswordCopied(false), 2000);
                    }}
                    disabled={!formData.password}
                    className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                    title={passwordCopied ? 'Copied' : 'Copy password'}
                    aria-label={passwordCopied ? 'Copied' : 'Copy password'}
                  >
                    {passwordCopied ? <FiCheck size={18} /> : <FiCopy size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-error-600 dark:text-error-500">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="admin-name" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Name
                </label>
                <input
                  id="admin-name"
                  type="text"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              {editingLock && (
                <p className="px-4 py-3 rounded-lg bg-warning-50 border border-warning-100 text-warning-700 text-sm dark:bg-warning-500/10 dark:border-warning-500/30 dark:text-warning-500">
                  {editingLock}
                </p>
              )}

              <div>
                <label htmlFor="admin-form-role" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Role
                </label>
                <select
                  id="admin-form-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminFormValues['role'] })}
                  disabled={!!editingLock}
                  className={inputClass}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-form-status" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Status
                </label>
                <select
                  id="admin-form-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as AdminFormValues['status'] })}
                  disabled={!!editingLock}
                  className={inputClass}
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
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={isSaving}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving…' : editingUser ? 'Save changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} isLoading={deactivateAdmin.isPending} />
    </div>
  );
};

export default Users;
