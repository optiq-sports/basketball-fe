/**
 * True only when the server actually answered and refused the credentials. A request that never
 * completed (offline, timeout, DNS, server down) is NOT an auth failure — the user is still
 * signed in and must stay signed in, otherwise going offline logs them out.
 * ApiClient reports those as status 0 / code NETWORK_ERROR.
 */
export function isAuthRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null | undefined)?.status;
  return status === 401 || status === 403;
}

export type GateDecision = 'login' | 'loading' | 'unreachable' | 'app';

export interface GateInput {
  hasToken: boolean;
  isLoading: boolean;
  /** True while a fetch is queued waiting for the network to come back (React Query "paused"). */
  isPaused?: boolean;
  isError: boolean;
  hasData: boolean;
  error: unknown;
}

/**
 * What AppGate should show for the current profile query state.
 *
 * - No token, or the server rejected the credentials → back to login.
 * - A profile we already have is kept even if a background re-check fails: the profile
 *   deliberately revalidates on every mount and window focus (staleTime 0), and that
 *   re-check will fail whenever the device is offline. Expired tokens are still caught because a
 *   real 401 is an auth rejection (handled first) and also broadcasts the session-expired event.
 * - No profile yet and the server can't be reached → a "can't reach the server" screen with
 *   retry, never login. The tokens stay put so the session resumes as soon as the network does.
 */
export function decideGate(input: GateInput): GateDecision {
  if (!input.hasToken) return 'login';
  if (input.isError && isAuthRejection(input.error)) return 'login';
  if (input.hasData) return 'app';
  if (input.isError || input.isPaused) return 'unreachable';
  if (input.isLoading) return 'loading';
  return 'loading';
}
