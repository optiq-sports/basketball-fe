import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../../types/api';

const h = vi.hoisted(() => ({
  setCaptain: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  removePlayer: { mutate: vi.fn(), isPending: false },
  confirmResult: { value: true },
}));

vi.mock('../../api/hooks', () => ({
  useSetTeamCaptain: () => h.setCaptain,
  useRemovePlayerFromTeam: () => h.removePlayer,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => h.confirmResult.value),
    dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' },
  }),
}));

import RosterTable from './RosterTable';

const player = (over: Partial<Player> = {}): Player => ({
  id: 'p1', firstName: 'Ana', lastName: 'Guard', position: 'POINT_GUARD', jerseyNumber: 7, isCaptain: false, nationality: 'USA', height: "5'8\"", ...over,
});

const renderTable = (players: Player[]) =>
  render(
    <MemoryRouter>
      <RosterTable teamId="t1" teamName="Sparks" players={players} onAddPlayers={vi.fn()} />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.setCaptain = { mutate: vi.fn(), isPending: false, variables: undefined };
  h.removePlayer = { mutate: vi.fn(), isPending: false };
  h.confirmResult.value = true;
});

describe('RosterTable', () => {
  it('shows the roster with jersey, position and nationality', () => {
    renderTable([player()]);
    const table = screen.getByRole('table');
    expect(within(table).getByText('7')).toBeTruthy();
    expect(within(table).getByText('Point Guard')).toBeTruthy();
    expect(within(table).getByText('USA')).toBeTruthy();
  });

  it('says there are no players yet and offers to add one', () => {
    renderTable([]);
    expect(screen.getByText('No players yet')).toBeTruthy();
  });

  it('makes a player captain', () => {
    renderTable([player()]);
    fireEvent.click(screen.getByRole('button', { name: 'Make Ana Guard captain' }));
    expect(h.setCaptain.mutate).toHaveBeenCalledWith({ teamId: 't1', playerId: 'p1', body: { isCaptain: true } }, expect.anything());
  });

  it('offers to remove captaincy from the current captain instead', () => {
    renderTable([player({ isCaptain: true })]);
    expect(screen.getByText('Captain')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Guard as captain' }));
    expect(h.setCaptain.mutate).toHaveBeenCalledWith({ teamId: 't1', playerId: 'p1', body: { isCaptain: false } }, expect.anything());
  });

  it('removes a player from the roster only after confirmation', async () => {
    renderTable([player()]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Guard' }));
    await waitFor(() => expect(h.removePlayer.mutate).toHaveBeenCalledWith({ playerId: 'p1', teamId: 't1' }, expect.anything()));
  });
});
