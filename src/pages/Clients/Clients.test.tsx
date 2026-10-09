import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  clients: { data: [] as unknown[], isPending: false, isError: false, error: null as unknown },
  keys: { data: [] as unknown[], isPending: false, isError: false, error: null as unknown },
  createClient: vi.fn(),
  createKey: vi.fn(),
  revokeKey: vi.fn(),
  assign: vi.fn(),
  confirmResult: { value: true },
}));

vi.mock('../../api/hooks', () => ({
  useClients: () => h.clients,
  useCreateClient: () => ({ mutate: h.createClient, isPending: false }),
  useClientApiKeys: () => h.keys,
  useCreateClientApiKey: () => ({ mutate: h.createKey, isPending: false }),
  useRevokeClientApiKey: () => ({ mutate: h.revokeKey, isPending: false }),
  useAssignClientUser: () => ({ mutate: h.assign, isPending: false }),
  useAdmins: () => ({ data: [{ id: 'u1', email: 'ops@optiq.test', name: 'Ops' }], isPending: false }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => h.confirmResult.value),
    dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' },
  }),
}));

import Clients from './Clients';

const acme = {
  id: 'c1',
  name: 'Acme Academy',
  websiteUrl: 'https://acme.test',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Clients />
    </QueryClientProvider>,
  );
}

describe('Clients page', () => {
  beforeEach(() => {
    h.clients = { data: [acme], isPending: false, isError: false, error: null };
    h.keys = { data: [], isPending: false, isError: false, error: null };
    h.createClient.mockReset();
    h.createKey.mockReset();
    h.revokeKey.mockReset();
    h.assign.mockReset();
    h.confirmResult.value = true;
  });

  it('lists clients and filters them by name', () => {
    h.clients = {
      data: [acme, { ...acme, id: 'c2', name: 'Harbor Hoops', websiteUrl: undefined }],
      isPending: false,
      isError: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText('Acme Academy')).toBeTruthy();
    expect(screen.getByText('Harbor Hoops')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search clients'), { target: { value: 'harbor' } });
    expect(screen.queryByText('Acme Academy')).toBeNull();
    expect(screen.getByText('Harbor Hoops')).toBeTruthy();
  });

  it('opens a client from a real button, so the keyboard can reach it', () => {
    renderPage();
    const open = screen.getByRole('button', { name: 'Acme Academy' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(open);
    expect(screen.getByRole('button', { name: 'Acme Academy' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('New API key name')).toBeTruthy();
  });

  it('says there are no clients yet, with a way to add one', () => {
    h.clients = { data: [], isPending: false, isError: false, error: null };
    renderPage();
    expect(screen.getByText('No clients yet')).toBeTruthy();
  });

  it('does not create a client until the required fields are filled in', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'New client' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    expect(await screen.findByText('Enter the client’s name.')).toBeTruthy();
    expect(screen.getByText('Enter the primary user’s email.')).toBeTruthy();
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it('shows a new API key once, with the copy-now warning, and then reveals nothing for that key again', async () => {
    h.createKey.mockImplementation((_vars, opts: { onSuccess: (d: unknown) => void }) =>
      opts.onSuccess({ id: 'k1', name: 'Scoreboard', clientId: 'c1', createdAt: acme.createdAt, apiKey: 'optiq_secret_123' }),
    );
    renderPage();
    fireEvent.click(screen.getByText('Acme Academy'));
    fireEvent.change(screen.getByLabelText('New API key name'), { target: { value: 'Scoreboard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByTestId('revealed-key')).toBeTruthy();
    expect(screen.getByText(/only time the key is shown/i)).toBeTruthy();
    expect(screen.getByTestId('revealed-key').textContent).toBe('optiq_secret_123');
    fireEvent.click(screen.getByRole('button', { name: 'I’ve saved it' }));
    await waitFor(() => expect(screen.queryByTestId('revealed-key')).toBeNull());
  });

  it('revoking a key asks first, and only revokes when confirmed', async () => {
    h.keys = { data: [{ id: 'k1', name: 'Scoreboard', clientId: 'c1', createdAt: acme.createdAt, lastUsed: null }], isPending: false, isError: false, error: null };
    renderPage();
    fireEvent.click(screen.getByText('Acme Academy'));
    const list = within(screen.getByRole('list'));
    fireEvent.click(list.getByRole('button', { name: /^Revoke / }));
    await waitFor(() => expect(h.revokeKey).toHaveBeenCalledWith({ id: 'k1', clientId: 'c1' }, expect.anything()));
  });

  it('does not revoke when the confirmation is cancelled', async () => {
    h.confirmResult.value = false;
    h.keys = { data: [{ id: 'k1', name: 'Scoreboard', clientId: 'c1', createdAt: acme.createdAt, lastUsed: null }], isPending: false, isError: false, error: null };
    renderPage();
    fireEvent.click(screen.getByText('Acme Academy'));
    fireEvent.click(within(screen.getByRole('list')).getByRole('button', { name: /^Revoke / }));
    await new Promise((r) => setTimeout(r, 0));
    expect(h.revokeKey).not.toHaveBeenCalled();
  });
});
