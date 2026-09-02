import { API_BASE } from '../config';

/** Dispatched when an authenticated API call returns 401 (expired or revoked token). */
export const AUTH_SESSION_EXPIRED_EVENT = 'basketball:auth-session-expired';

export function broadcastAuthSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(tokens: { access_token?: string; refresh_token?: string }): void {
  if (tokens.access_token) localStorage.setItem(TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('user_name');
}

type RefreshResponsePayload = {
  data?: { access_token?: string; refresh_token?: string };
  access_token?: string;
  refresh_token?: string;
};

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Calls POST /auth/refresh directly via `fetch`, bypassing ApiClient/statdashRequest —
 * both of those call this function when they see a 401, so going through either of them
 * here would recurse. Concurrent 401s from multiple in-flight requests share one refresh
 * call instead of each firing their own (see `refreshInFlight`).
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return null;
      const payload = (await response.json().catch(() => null)) as RefreshResponsePayload | null;
      const data = payload?.data ?? payload;
      if (!data?.access_token) return null;
      storeAuthTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Clears the local session immediately (so the UI can navigate away without waiting on a
 * network round-trip) and notifies the backend to revoke the refresh token's session row
 * as a fire-and-forget best effort afterward — a slow or failed logout call should never
 * delay or block the user from actually leaving. Raw `fetch` for the same
 * recursion-avoidance reason as `refreshAccessToken`.
 */
export function performLogout(): void {
  const refreshToken = getRefreshToken();
  clearAuthTokens();
  if (!refreshToken) return;
  void fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => {
    // Ignore — the local session is already cleared regardless.
  });
}
