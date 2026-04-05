/** Dispatched when an authenticated API call returns 401 (expired or revoked token). */
export const AUTH_SESSION_EXPIRED_EVENT = 'basketball:auth-session-expired';

export function broadcastAuthSessionExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}
