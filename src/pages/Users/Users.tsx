import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdmins, useCreateAdmin, useDeleteAdmin, useProfile, useUpdateAdmin } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Admin, AdminCreateBody, AdminUpdateBody } from '../../types/api';
import { PageHeader } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Badge } from '../../components/ui/primitives/badge';
import DataTable from '../../components/ui/DataTable';
import AdminFormDialog from '../../components/admins/AdminFormDialog';
import DeactivateAdminDialog, { type DeactivateAdminTarget } from '../../components/admins/DeactivateAdminDialog';
import { ROLES, roleLabel } from '../../components/admins/admin-form';
import { isSelf, lockReason, type Me } from '../../components/admins/admin-rules';

const selectClass =
  'h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

const labelOf = (a: Admin) => a.name?.trim() || a.email;

/**
 * Admins and super admins, in a table: there are few of them, they have no photos, and the point is
 * comparing role and status across rows. Only a SUPER_ADMIN reaches this page (`UsersRouteGuard`, and
 * the whole `/admin` controller is SUPER_ADMIN-only).
 *
 * Role, status and search live in the URL and filter the full list in the browser — the backend takes
 * `search` and ignores it (Gap 39), and the list is short enough that nothing is lost.
 *
 * "Deactivate", not "Delete": `DELETE /admin/:id` only sets the status to INACTIVE. The backend also
 * lets you deactivate or demote yourself, or the last super admin, which would lock everyone out of
 * this page, so `admin-rules` blocks both here (Gap 41).
 */
const Users: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

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

  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => setParam({ q: draft.trim() || null }), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const adminsQuery = useAdmins();
  const profileQuery = useProfile();
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deactivate = useDeleteAdmin();

  const me: Me | undefined = profileQuery.data ? { id: profileQuery.data.id, email: profileQuery.data.email } : undefined;
  const all: Admin[] = useMemo(() => adminsQuery.data ?? [], [adminsQuery.data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (a) =>
        (!role || a.role === role) &&
        (!status || (a.status ?? 'ACTIVE') === status) &&
        (!needle || (a.name ?? '').toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle)),
    );
  }, [all, role, status, q]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [target, setTarget] = useState<DeactivateAdminTarget | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setFormError(null); setFormOpen(true); };
  const openEdit = (a: Admin) => { setEditing(a); setFormError(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const create = (body: AdminCreateBody) => {
    setFormError(null);
    createAdmin.mutate(body, {
      onSuccess: (created) => {
        toast.success(
          body.password ? `${labelOf(created)} added.` : `${labelOf(created)} added. The server was asked to email them a temporary password. If it doesn’t arrive, set one from Edit.`,
        );
        closeForm();
      },
      onError: (err) => setFormError(err.message),
    });
  };

  const update = (body: AdminUpdateBody) => {
    if (!editing) return;
    setFormError(null);
    if (Object.keys(body).length === 0) { closeForm(); return; }
    const who = editing;
    updateAdmin.mutate(
      { id: who.id, data: body },
      {
        onSuccess: () => { toast.success(`${labelOf(who)} saved.`); closeForm(); },
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const confirmDeactivate = () => {
    if (!target) return;
    const t = target;
    deactivate.mutate(t.id, {
      onSuccess: () => { toast.success(`${t.label} deactivated.`); setTarget(null); },
      onError: (err) => { toast.error(`Couldn’t deactivate ${t.label}: ${err.message}`); setTarget(null); },
    });
  };

  const reactivate = (a: Admin) => {
    setReactivatingId(a.id);
    updateAdmin.mutate(
      { id: a.id, data: { status: 'ACTIVE' } },
      {
        onSuccess: () => toast.success(`${labelOf(a)} reactivated.`),
        onError: (err) => toast.error(`Couldn’t reactivate ${labelOf(a)}: ${err.message}`),
        onSettled: () => setReactivatingId(null),
      },
    );
  };

  const columns = useMemo<ColumnDef<Admin>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (a) => labelOf(a).toLowerCase(),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900 dark:text-white">
              {row.original.name?.trim() || '—'}
              {isSelf(row.original, me) && <Badge variant="court" className="ml-2 align-middle">You</Badge>}
            </p>
            <p className="truncate text-sm text-gray-500">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge variant={row.original.role === 'SUPER_ADMIN' ? 'court' : 'neutral'}>{roleLabel(row.original.role)}</Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'INACTIVE' ? <Badge variant="warning">Inactive</Badge> : <Badge variant="success">Active</Badge>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Added',
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original;
          const locked = lockReason(a, all, me);
          const label = labelOf(a);
          return (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" aria-label={`Edit ${label}`} onClick={() => openEdit(a)}>Edit</Button>
              {a.status === 'INACTIVE' ? (
                <Button variant="secondary" size="sm" aria-label={`Reactivate ${label}`} onClick={() => reactivate(a)} disabled={reactivatingId === a.id}>
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="destructive-ghost"
                  size="sm"
                  aria-label={`Deactivate ${label}`}
                  title={locked ?? undefined}
                  disabled={!!locked}
                  onClick={() => setTarget({ id: a.id, label })}
                >
                  Deactivate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // openEdit/reactivate only read stable setters; the data they depend on is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, me?.id, me?.email, reactivatingId],
  );

  const hasFilter = !!(role || status || q);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admins"
        description="Who can manage the platform. Only super administrators can see this page."
        actions={<Button onClick={openCreate}>Add admin</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:max-w-sm">
          <label htmlFor="admin-search" className="sr-only">Search admins</label>
          <input
            id="admin-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="admin-role" className="sr-only">Filter by role</label>
          <select id="admin-role" className={selectClass} value={role} onChange={(e) => setParam({ role: e.target.value || null })}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="admin-status" className="sr-only">Filter by status</label>
          <select id="admin-status" className={selectClass} value={status.toLowerCase()} onChange={(e) => setParam({ status: e.target.value || null })}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setDraft(''); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={adminsQuery.isPending}
        error={adminsQuery.isError ? (adminsQuery.error as Error).message : null}
        onRetry={() => void adminsQuery.refetch()}
        emptyMessage={hasFilter ? 'No admins match these filters.' : 'No admins yet.'}
      />

      <AdminFormDialog
        open={formOpen}
        onClose={closeForm}
        initial={editing}
        lockedReason={editing ? lockReason(editing, all, me) : null}
        isSaving={createAdmin.isPending || updateAdmin.isPending}
        serverError={formError}
        onCreate={create}
        onUpdate={update}
      />

      <DeactivateAdminDialog target={target} isWorking={deactivate.isPending} onCancel={() => setTarget(null)} onConfirm={confirmDeactivate} />
    </div>
  );
};

export default Users;
