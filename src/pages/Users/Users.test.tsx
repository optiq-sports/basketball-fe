import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  admins: null as unknown,
  profile: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  deactivate: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api/hooks', () => ({
  useAdmins: () => h.admins,
  useProfile: () => h.profile,
  useCreateAdmin: () => h.create,
  useUpdateAdmin: () => h.update,
  useDeleteAdmin: () => h.deactivate,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import Users from './Users';

const admin = (id: string, email: string, role: string, over: Record<string, unknown> = {}) => ({
  id, email, name: id.toUpperCase(), role, status: 'ACTIVE', createdAt: '2026-01-05T00:00:00Z', ...over,
});

function Where() {
  return <div data-testid="where">{useLocation().search}</div>;
}
function renderAt(path = '/users') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/users" element={<Users />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.admins = ok([
    admin('root', 'root@x.com', 'SUPER_ADMIN'),
    admin('ann', 'ann@x.com', 'ADMIN'),
    admin('bob', 'bob@x.com', 'ADMIN', { status: 'INACTIVE' }),
  ]);
  h.profile = ok({ id: 'root', email: 'root@x.com', role: 'SUPER_ADMIN' });
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.deactivate = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Users', () => {
  it('lists admins with role and status, and marks the signed-in one', () => {
    renderAt();
    expect(screen.getByText('ann@x.com')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
  });

  it('filters by role, status and search through the URL', () => {
    renderAt('/users?role=ADMIN&status=active');
    expect(screen.getByText('ann@x.com')).toBeInTheDocument();
    expect(screen.queryByText('bob@x.com')).not.toBeInTheDocument();
    expect(screen.queryByText('root@x.com')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: '' } });
    expect(screen.getByTestId('where')).toHaveTextContent('role=ADMIN');
    expect(screen.getByTestId('where')).not.toHaveTextContent('status');
  });

  it('cannot deactivate yourself, or the only active super admin', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Deactivate ROOT' })).toBeDisabled();
  });

  it('asks before deactivating someone else, then deactivates', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate ANN' }));
    expect(h.deactivate.mutate).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    expect(h.deactivate.mutate).toHaveBeenCalledWith('ann', expect.any(Object));
  });

  it('reactivates an inactive admin', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate BOB' }));
    expect(h.update.mutate).toHaveBeenCalledWith({ id: 'bob', data: { status: 'ACTIVE' } }, expect.any(Object));
  });

  it('locks role and status when editing yourself, and explains why', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit ROOT' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/your own account/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Role')).toBeDisabled();
    expect(within(dialog).getByLabelText('Status')).toBeDisabled();
  });

  it('offers only the two admin roles', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add admin' }));
    const options = within(within(screen.getByRole('dialog')).getByLabelText('Role')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Super administrator', 'Administrator']);
  });

  it('creates with no password so the backend emails one', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add admin' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'new@x.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add admin' }));
    await waitFor(() =>
      expect(h.create.mutate).toHaveBeenCalledWith({ email: 'new@x.com', role: 'ADMIN', status: 'ACTIVE' }, expect.any(Object)),
    );
  });

  it('will not create without a valid email, or with a short password', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add admin' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'nope' } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), { target: { value: 'abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add admin' }));
    expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(within(dialog).getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('keeps the stored role and status in an edit of a locked account', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit ROOT' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith({ id: 'root', data: { name: 'Renamed' } }, expect.any(Object)));
  });

  it('shows an error with a retry', () => {
    h.admins = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
