import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshUnavailableError, refreshAccessToken } from './authSession';

function respond(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('refreshAccessToken', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'old-access');
    localStorage.setItem('refresh_token', 'old-refresh');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores and returns the new tokens when the server accepts the refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { data: { access_token: 'new-access', refresh_token: 'new-refresh' } })));
    await expect(refreshAccessToken()).resolves.toBe('new-access');
    expect(localStorage.getItem('access_token')).toBe('new-access');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
  });

  it('resolves null when the server rejects the refresh token (the session is really dead)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401, { message: 'Invalid refresh token' })));
    await expect(refreshAccessToken()).resolves.toBeNull();
  });

  it('resolves null when there is no refresh token to try', async () => {
    localStorage.removeItem('refresh_token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('REGRESSION: a dropped network is reported as unavailable, not as a dead session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(refreshAccessToken()).rejects.toBeInstanceOf(RefreshUnavailableError);
    expect(localStorage.getItem('refresh_token')).toBe('old-refresh');
  });

  it('treats a server error while refreshing as unavailable too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(503)));
    await expect(refreshAccessToken()).rejects.toBeInstanceOf(RefreshUnavailableError);
  });

  it('can be retried after a failure (the in-flight guard is released)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respond(200, { data: { access_token: 'second-try' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(refreshAccessToken()).rejects.toBeInstanceOf(RefreshUnavailableError);
    await expect(refreshAccessToken()).resolves.toBe('second-try');
  });
});
