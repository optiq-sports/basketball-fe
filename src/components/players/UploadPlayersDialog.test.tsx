import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  teams: null as unknown,
  upload: { mutate: vi.fn(), isPending: false, reset: vi.fn(), isError: false, error: null as unknown },
}));

vi.mock('../../api/hooks', () => ({
  useTeams: () => h.teams,
  useUploadPlayersExcel: () => h.upload,
}));

import UploadPlayersDialog from './UploadPlayersDialog';

const file = (name: string) => new File(['x'], name, { type: 'application/octet-stream' });

beforeEach(() => {
  h.teams = { data: [{ id: 'team-1', name: 'MARKTOWN FLYERS', code: 'MTF' }], isPending: false, isError: false, error: null };
  h.upload = { mutate: vi.fn(), isPending: false, reset: vi.fn(), isError: false, error: null };
});

const open = () => render(<UploadPlayersDialog open onClose={vi.fn()} />);

describe('UploadPlayersDialog: picking a file', () => {
  it('lists teams in normal case, not as stored', () => {
    open();
    expect(within(screen.getByLabelText(/^Team/)).getByRole('option', { name: 'Marktown Flyers' })).toBeInTheDocument();
  });

  it('refuses anything that is not .xlsx, and says why', () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Spreadsheet/), { target: { files: [file('squad.csv')] } });
    expect(screen.getByText(/Only .xlsx files can be read/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('uploads once a team and an .xlsx file are chosen', () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Team/), { target: { value: 'team-1' } });
    const xlsx = file('squad.xlsx');
    fireEvent.change(screen.getByLabelText(/^Spreadsheet/), { target: { files: [xlsx] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(h.upload.mutate).toHaveBeenCalledWith({ teamId: 'team-1', file: xlsx }, expect.anything());
  });

  it('names the columns the backend actually reads', () => {
    open();
    expect(screen.getByText(/First name · Last name · Jersey number/)).toBeInTheDocument();
  });
});

describe('UploadPlayersDialog: the result', () => {
  /** Drives the dialog to its summary by running the mutation's onSuccess with a canned result. */
  const uploadWith = (result: unknown) => {
    h.upload.mutate = vi.fn((_vars, opts: { onSuccess: (d: unknown) => void }) => opts.onSuccess(result));
    open();
    fireEvent.change(screen.getByLabelText(/^Team/), { target: { value: 'team-1' } });
    fireEvent.change(screen.getByLabelText(/^Spreadsheet/), { target: { files: [file('squad.xlsx')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  };

  it('counts what was read, added and already known', () => {
    uploadWith({ totalProcessed: 10, created: 7, duplicatesFound: 3, errors: [], details: [] });
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the rows the backend could not use — they used to be hidden', () => {
    uploadWith({
      totalProcessed: 2,
      created: 1,
      duplicatesFound: 0,
      errors: [{ row: 4, error: 'Missing First or Last Name' }],
      details: [],
    });
    expect(screen.getByText(/1 row couldn’t be used/)).toBeInTheDocument();
    expect(screen.getByText('Row 4:')).toBeInTheDocument();
    expect(screen.getByText('Missing First or Last Name')).toBeInTheDocument();
  });

  it('explains what happened to each player it already had, in words', () => {
    uploadWith({
      totalProcessed: 3,
      created: 0,
      duplicatesFound: 3,
      errors: [],
      details: [
        { row: 2, player: 'Teddy Okereafor', action: 'LINKED', matchScore: '100.00' },
        { row: 3, player: 'Fahro Alihodzic', action: 'ALREADY_IN_TEAM' },
        { row: 4, player: 'Ada Eze', action: 'SKIPPED', matchScore: '81.50' },
      ],
    });
    expect(screen.getByText('Signed to this team')).toBeInTheDocument();
    expect(screen.getByText('Already on this team')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    // The backend's similarity score is a percentage, sent as a 2-decimal string.
    expect(screen.getByText('100% match')).toBeInTheDocument();
    expect(screen.getByText('82% match')).toBeInTheDocument();
  });

  it('says so when the sheet had no rows at all', () => {
    uploadWith({ totalProcessed: 0, created: 0, duplicatesFound: 0, errors: [], details: [] });
    expect(screen.getByText(/no rows to read/i)).toBeInTheDocument();
  });
});
