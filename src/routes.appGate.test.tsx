import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ProfileState = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: 'idle' | 'fetching' | 'paused';
  data?: { role: string };
  error: unknown;
  refetch: () => Promise<unknown>;
};

const profileState: { current: ProfileState } = {
  current: { isLoading: false, isError: false, isFetching: false, fetchStatus: 'idle', error: null, refetch: async () => undefined },
};

vi.mock('./api/hooks', () => ({
  useProfile: () => profileState.current,
  queryKeys: { auth: { profile: ['auth', 'profile'] } },
}));
vi.mock('./pages/login/login', () => ({ default: () => <div>LOGIN PAGE</div> }));
vi.mock('./pages/login/ForgotPassword', () => ({ default: () => <div>FORGOT PAGE</div> }));
vi.mock('./components/wrapper', () => ({ default: () => <div>ADMIN SHELL</div> }));
vi.mock('./contexts/StatisticianTeamColorsContext', () => ({
  StatisticianTeamColorsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./utils/enterFullscreen', () => ({ enterFullscreenBestEffort: () => undefined }));

import AppRoutes from './routes';

function renderAt(path: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const networkError = { status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' };

describe('AppGate when the profile check fails', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'access');
    localStorage.setItem('refresh_token', 'refresh');
  });

  it('REGRESSION: stays in the app, still signed in, when a background profile re-check fails offline', () => {
    profileState.current = {
      ...profileState.current,
      data: { role: 'ADMIN' },
      isError: true,
      error: networkError,
    };
    renderAt('/tournaments');
    expect(screen.getByText('ADMIN SHELL')).toBeTruthy();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(localStorage.getItem('access_token')).toBe('access');
    expect(localStorage.getItem('refresh_token')).toBe('refresh');
  });

  it('shows a "can\'t reach the server" screen, not login, when there is no network on first load', () => {
    profileState.current = { ...profileState.current, data: undefined, isError: true, error: networkError };
    renderAt('/tournaments');
    expect(screen.getByText(/can.t reach the server/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(screen.queryByText('LOGIN PAGE')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBe('refresh');
  });

  it('still sends the user to login and clears the session when the server rejects the token', () => {
    profileState.current = { ...profileState.current, data: undefined, isError: true, error: { status: 401 } };
    renderAt('/tournaments');
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('sends a visitor with no token to login', () => {
    localStorage.clear();
    profileState.current = { ...profileState.current, data: undefined, isError: false, error: null };
    renderAt('/tournaments');
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy();
  });
});
