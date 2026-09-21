import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_SESSION_EXPIRED_EVENT } from '../../auth/authSession';
import { StatDashApiError, statdashRequest } from './client';

function respond(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('statdashRequest auth handling', () => {
  let expiredEvents = 0;
  const onExpired = () => {
    expiredEvents += 1;
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'expired-access');
    localStorage.setItem('refresh_token', 'refresh');
    expiredEvents = 0;
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
  });

  afterEach(() => {
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    vi.unstubAllGlobals();
  });

  it('REGRESSION: a network drop while refreshing keeps the session and reports a retryable network error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401)) // the original request: access token expired
      .mockRejectedValueOnce(new TypeError('Failed to fetch')); // the refresh call: network gone
    vi.stubGlobal('fetch', fetchMock);

    const error = await statdashRequest('/statdash/events/command', { method: 'POST' }).catch((e) => e);

    expect(error).toBeInstanceOf(StatDashApiError);
    expect((error as StatDashApiError).status).toBe(0); // the event queue keeps status-0 commands pending
    expect(localStorage.getItem('access_token')).toBe('expired-access');
    expect(localStorage.getItem('refresh_token')).toBe('refresh');
    expect(expiredEvents).toBe(0);
  });

  it('still ends the session when the server rejects the refresh token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(401, { message: 'Invalid refresh token' }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await statdashRequest('/statdash/events/command', { method: 'POST' }).catch((e) => e);

    expect((error as StatDashApiError).status).toBe(401);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(expiredEvents).toBe(1);
  });

  it('retries the request with the new token after a successful silent refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(401))
      .mockResolvedValueOnce(respond(200, { data: { access_token: 'fresh-access' } }))
      .mockResolvedValueOnce(respond(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(statdashRequest('/statdash/sessions/x/state')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('access_token')).toBe('fresh-access');
  });
});
