import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  health: null as unknown,
  lag: null as unknown,
  requeue: { mutate: vi.fn(), isPending: false },
  warm: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  invalidate: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries: h.invalidate }),
}));
vi.mock('../../api/hooks', () => ({
  queryKeys: { ops: { health: ['ops', 'health'], lag: ['ops', 'lag'] } },
  useQueueHealth: () => h.health,
  useQueueLag: () => h.lag,
  useRequeueDeadLetter: () => h.requeue,
  useWarmSession: () => h.warm,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import QueueDashboard from './QueueDashboard';

const q = (data: unknown, over: Record<string, unknown> = {}) => ({
  data, isPending: false, isFetching: false, isError: false, dataUpdatedAt: 1_700_000_000_000, ...over,
});

const counts = (over: Record<string, number> = {}) => ({ active: 1, waiting: 2, failed: 3, delayed: 4, completed: 5, ...over });

beforeEach(() => {
  h.health = q({ enabled: true, queues: { 'statdash-projections': counts(), 'statdash-recompute': counts({ failed: 0 }), 'statdash-matchstat-sync': counts() } });
  h.lag = q({ enabled: true, lag: { 'statdash-projections': { waiting: 2, oldestWaitingMs: 90_000 } } });
  h.requeue = { mutate: vi.fn(), isPending: false };
  h.warm = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
  h.invalidate.mockReset();
});

describe('QueueDashboard', () => {
  it('shows each queue’s counts and that Redis is connected', () => {
    render(<QueueDashboard />);
    expect(screen.getByText('Redis connected')).toBeInTheDocument();
    const card = screen.getByLabelText('Projection rebuild');
    expect(within(card).getByText('Failed').nextSibling).toHaveTextContent('3');
  });

  it('shows how long the oldest job has waited', () => {
    render(<QueueDashboard />);
    expect(screen.getByText('1m 30s')).toBeInTheDocument();
  });

  it('refresh refetches both queries', () => {
    render(<QueueDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(h.invalidate).toHaveBeenCalledTimes(2);
  });

  it('asks before requeueing, and only then requeues', async () => {
    render(<QueueDashboard />);
    fireEvent.change(screen.getByLabelText('Up to'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Requeue' }));
    expect(await screen.findByText(/Up to 40 failed jobs/)).toBeInTheDocument();
    expect(h.requeue.mutate).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Requeue' }));
    await waitFor(() => expect(h.requeue.mutate).toHaveBeenCalledWith(40, expect.any(Object)));
  });

  it('does not requeue when the confirmation is cancelled', async () => {
    render(<QueueDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Requeue' }));
    await screen.findByRole('dialog');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(h.requeue.mutate).not.toHaveBeenCalled();
  });

  it('clamps an out-of-range limit', async () => {
    render(<QueueDashboard />);
    fireEvent.change(screen.getByLabelText('Up to'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Requeue' }));
    expect(await screen.findByText(/Up to 200 failed jobs/)).toBeInTheDocument();
  });

  it('warms a session by id', () => {
    render(<QueueDashboard />);
    const warm = screen.getByRole('button', { name: 'Warm' });
    expect(warm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Session ID'), { target: { value: ' sess-1 ' } });
    fireEvent.click(warm);
    expect(h.warm.mutate).toHaveBeenCalledWith('sess-1', expect.any(Object));
  });

  it('disables both actions and says why when Redis is off', () => {
    h.health = q({ enabled: false, queues: {} });
    render(<QueueDashboard />);
    expect(screen.getByText('Redis disabled')).toBeInTheDocument();
    expect(screen.getByText(/Redis is switched off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Requeue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Warm' })).toBeDisabled();
  });

  it('shows an error with a retry when the data does not load', () => {
    h.health = q(undefined, { isError: true, isPending: false });
    render(<QueueDashboard />);
    expect(screen.getByText(/Couldn’t load queue data/)).toBeInTheDocument();
  });
});
