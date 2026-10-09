import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  unassigned: { data: [{ id: 'p1', firstName: 'Ana', lastName: 'Guard' }, { id: 'p2', firstName: 'Ben', lastName: 'Wing' }], isPending: false, isError: false, error: null },
  assign: { mutate: vi.fn(), isPending: false },
  create: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../api/hooks', () => ({
  usePlayers: () => h.unassigned,
  useAssignPlayerToTeam: () => h.assign,
  useCreatePlayerForTeam: () => h.create,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import AddPlayerDialog from './AddPlayerDialog';

beforeEach(() => {
  h.unassigned = { data: [{ id: 'p1', firstName: 'Ana', lastName: 'Guard' }, { id: 'p2', firstName: 'Ben', lastName: 'Wing' }], isPending: false, isError: false, error: null };
  h.assign = { mutate: vi.fn(), isPending: false };
  h.create = { mutate: vi.fn(), isPending: false };
  h.upload = { mutate: vi.fn(), isPending: false };
});

const renderDialog = () => render(<AddPlayerDialog open onClose={vi.fn()} teamId="t1" />);

describe('AddPlayerDialog: existing player', () => {
  it('needs a player chosen and a jersey number before it can be added', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Add to roster' }));
    expect(await screen.findByText('Choose a player.')).toBeTruthy();
    expect(screen.getByText('Enter a jersey number from 0 to 99.')).toBeTruthy();
    expect(h.assign.mutate).not.toHaveBeenCalled();
  });

  it('adds the chosen player with the jersey number', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'Ben Wing' }));
    fireEvent.change(screen.getByLabelText('Jersey number', { exact: false }), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to roster' }));
    await waitFor(() => expect(h.assign.mutate).toHaveBeenCalledWith({ playerId: 'p2', teamId: 't1', body: { jerseyNumber: 9 } }, expect.anything()));
  });
});

describe('AddPlayerDialog: new player', () => {
  it('blocks a player with no name or jersey number', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: 'New player' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & add' }));
    expect(await screen.findByText('Enter a first name.')).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('creates a player with the fields entered', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: 'New player' }));
    fireEvent.change(screen.getByLabelText('First name', { exact: false }), { target: { value: 'Chris' } });
    fireEvent.change(screen.getByLabelText('Last name', { exact: false }), { target: { value: 'Post' } });
    fireEvent.change(screen.getByLabelText('Jersey number', { exact: false }), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & add' }));
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledWith({ teamId: 't1', firstName: 'Chris', lastName: 'Post', jerseyNumber: 11 }, expect.anything()));
  });

  it('offers "Create anyway" only for a potential-duplicate conflict, and resubmits with the override flag', async () => {
    h.create.mutate = vi
      .fn()
      .mockImplementationOnce((_body: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Potential duplicate found (88.00% similarity). Verify and confirm to proceed.')))
      .mockImplementationOnce((_body: unknown, opts: { onSuccess: (p: unknown) => void }) => opts.onSuccess({ firstName: 'Chris', lastName: 'Post' }));
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: 'New player' }));
    fireEvent.change(screen.getByLabelText('First name', { exact: false }), { target: { value: 'Chris' } });
    fireEvent.change(screen.getByLabelText('Last name', { exact: false }), { target: { value: 'Post' } });
    fireEvent.change(screen.getByLabelText('Jersey number', { exact: false }), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & add' }));
    const retry = await screen.findByRole('button', { name: 'Create anyway' });
    fireEvent.click(retry);
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledTimes(2));
    expect(h.create.mutate).toHaveBeenLastCalledWith(expect.objectContaining({ confirmDuplicate: true }), expect.anything());
  });

  it('does not offer "Create anyway" for an unrelated conflict, such as a taken jersey number', async () => {
    h.create.mutate = vi.fn((_body: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Jersey number 11 is already taken in this team')));
    renderDialog();
    fireEvent.click(screen.getByRole('tab', { name: 'New player' }));
    fireEvent.change(screen.getByLabelText('First name', { exact: false }), { target: { value: 'Chris' } });
    fireEvent.change(screen.getByLabelText('Last name', { exact: false }), { target: { value: 'Post' } });
    fireEvent.change(screen.getByLabelText('Jersey number', { exact: false }), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & add' }));
    expect(await screen.findByText(/already taken/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create anyway' })).toBeNull();
  });
});
