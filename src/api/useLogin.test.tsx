import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ auth: { login: vi.fn() } }));
vi.mock('./ApiClient', () => ({ apiClient: api }));

import { queryKeys, useLogin } from './hooks';

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const signIn = async (user: Record<string, unknown>) => {
  api.auth.login.mockResolvedValue({ ok: true, data: { access_token: 'tok', refresh_token: 'ref', user } });
  const { result } = renderHook(() => useLogin(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ email: 'a@x.com', password: 'secret' });
  });
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  localStorage.clear();
  api.auth.login.mockReset();
});

describe('useLogin and the profile cache', () => {
  it('keeps the tokens either way', async () => {
    await signIn({ id: 'u1', role: 'CLIENT' });
    expect(localStorage.getItem('access_token')).toBe('tok');
    expect(localStorage.getItem('refresh_token')).toBe('ref');
  });

  it('does not treat a login response without the password-change flag as the profile', async () => {
    // The backend's login response has no `forcePasswordChange`. Reading its absence as "no change
    // needed" let a user with a temporary password see the whole app until the real profile arrived.
    await signIn({ id: 'u1', role: 'CLIENT', name: 'Ada' });
    expect(client.getQueryData(queryKeys.auth.profile)).toBeUndefined();
  });

  it('throws away a profile left over from a previous session when the new login has no flag', async () => {
    client.setQueryData(queryKeys.auth.profile, { id: 'someone-else', role: 'ADMIN', forcePasswordChange: false });
    await signIn({ id: 'u1', role: 'CLIENT' });
    expect(client.getQueryData(queryKeys.auth.profile)).toBeUndefined();
  });

  it('uses the login response as the profile when it says whether a change is needed', async () => {
    await signIn({ id: 'u1', role: 'ADMIN', forcePasswordChange: false });
    expect(client.getQueryData(queryKeys.auth.profile)).toMatchObject({ id: 'u1', forcePasswordChange: false });
  });

  it('and does so when a change is required, so the gate shows the change screen at once', async () => {
    await signIn({ id: 'u1', role: 'CLIENT', forcePasswordChange: true });
    expect(client.getQueryData(queryKeys.auth.profile)).toMatchObject({ forcePasswordChange: true });
  });

  it('remembers the user name for the header', async () => {
    await signIn({ id: 'u1', role: 'CLIENT', name: '  Ada  ' });
    expect(localStorage.getItem('user_name')).toBe('Ada');
  });
});
