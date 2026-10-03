import { describe, expect, it } from 'vitest';
import { decideGate, isAuthRejection, isPasswordChangeRequired } from './gateDecision';

const networkError = { status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' };
const base = { hasToken: true, isLoading: false, isError: false, hasData: false, error: null };

describe('isAuthRejection', () => {
  it('is true only for a 401/403 the server actually sent', () => {
    expect(isAuthRejection({ status: 401 })).toBe(true);
    expect(isAuthRejection({ status: 403 })).toBe(true);
  });

  it('is false for network failures and server errors', () => {
    expect(isAuthRejection(networkError)).toBe(false);
    expect(isAuthRejection({ status: 500 })).toBe(false);
    expect(isAuthRejection(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAuthRejection(null)).toBe(false);
    expect(isAuthRejection(undefined)).toBe(false);
  });
});

describe('decideGate', () => {
  it('sends a visitor with no token to login', () => {
    expect(decideGate({ ...base, hasToken: false })).toBe('login');
  });

  it('shows the app once the profile has loaded', () => {
    expect(decideGate({ ...base, hasData: true })).toBe('app');
  });

  it('waits while the first profile request is in flight', () => {
    expect(decideGate({ ...base, isLoading: true })).toBe('loading');
  });

  it('REGRESSION: going offline does not log a signed-in user out', () => {
    // Profile revalidates on every focus/mount; with no network that background check fails.
    expect(decideGate({ ...base, hasData: true, isError: true, error: networkError })).toBe('app');
  });

  it('does not log out when the very first profile request cannot reach the server', () => {
    expect(decideGate({ ...base, isError: true, error: networkError })).toBe('unreachable');
    expect(decideGate({ ...base, isError: true, error: { status: 503 } })).toBe('unreachable');
  });

  it('shows the unreachable screen while the request is paused waiting for the network', () => {
    expect(decideGate({ ...base, isPaused: true })).toBe('unreachable');
  });

  it('still logs out when the server rejects the credentials, with or without a cached profile', () => {
    expect(decideGate({ ...base, isError: true, error: { status: 401 } })).toBe('login');
    expect(decideGate({ ...base, hasData: true, isError: true, error: { status: 401 } })).toBe('login');
  });

  describe('REGRESSION: a new account forced to change its password is not bounced to login', () => {
    const forced = { status: 403, message: 'PASSWORD_CHANGE_REQUIRED' };

    it('isPasswordChangeRequired recognizes exactly this 403, not any other 403/401', () => {
      expect(isPasswordChangeRequired(forced)).toBe(true);
      expect(isPasswordChangeRequired({ status: 403 })).toBe(false);
      expect(isPasswordChangeRequired({ status: 403, message: 'Forbidden resource' })).toBe(false);
      expect(isPasswordChangeRequired({ status: 401, message: 'PASSWORD_CHANGE_REQUIRED' })).toBe(false);
      expect(isPasswordChangeRequired(null)).toBe(false);
    });

    it('sends the gate to the change-password screen instead of clearing the token and logging out', () => {
      expect(decideGate({ ...base, isError: true, error: forced })).toBe('password-change');
      // Even with a profile already cached (seeded from the login response right before this
      // check fires) — the forced-change screen still wins, same priority as a real rejection.
      expect(decideGate({ ...base, hasData: true, isError: true, error: forced })).toBe('password-change');
    });

    it('a generic 403 (no forced-change message) still goes to login, same as before', () => {
      expect(decideGate({ ...base, isError: true, error: { status: 403 } })).toBe('login');
    });
  });
});
