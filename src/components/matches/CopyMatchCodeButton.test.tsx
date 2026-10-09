import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchCodeOf } from '../../lib/match-code';
import SchedulesRedirect from '../../pages/tournaments/SchedulesRedirect';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => toast }));

import { CopyMatchCodeButton } from './CopyMatchCodeButton';

const clipboard = vi.hoisted(() => ({ writeText: vi.fn() }));

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
  clipboard.writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
});

describe('matchCodeOf', () => {
  it('uses the match key when there is one, and the id when there is not', () => {
    expect(matchCodeOf({ id: 'abc123', matchKey: ' KEY-9 ' })).toBe('KEY-9');
    expect(matchCodeOf({ id: 'abc123', matchKey: null })).toBe('abc123');
    expect(matchCodeOf({ id: 'abc123' })).toBe('abc123');
    expect(matchCodeOf({ id: 'abc123', matchKey: '   ' })).toBe('abc123');
  });
});

describe('CopyMatchCodeButton', () => {
  it('copies the code and says so', async () => {
    clipboard.writeText.mockResolvedValue(undefined);
    render(<CopyMatchCodeButton code="abc123" label="Alpha vs Bravo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy match code for Alpha vs Bravo' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenCalledWith('abc123'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/copied/i)));
  });

  it('shows the code instead when the browser refuses to copy', async () => {
    clipboard.writeText.mockRejectedValue(new Error('denied'));
    render(<CopyMatchCodeButton code="abc123" label="Alpha vs Bravo" />);
    fireEvent.click(screen.getByRole('button', { name: /Copy match code/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('abc123')));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('SchedulesRedirect', () => {
  it('sends the old schedules address to that tournament’s fixtures', () => {
    render(
      <MemoryRouter initialEntries={['/tournaments/t9/schedules']}>
        <Routes>
          <Route path="/tournaments/:id/schedules" element={<SchedulesRedirect />} />
          <Route path="/tournaments/:id/fixtures" element={<div>fixtures for the tournament</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('fixtures for the tournament')).toBeInTheDocument();
  });
});
