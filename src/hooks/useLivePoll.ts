import { useEffect, useRef } from 'react';

/**
 * Calls `refetch` every `intervalMs` while `active` is true, and not at all otherwise. For screens that
 * show a live game but don't subscribe to the StatDash SSE stream themselves (that's the statistician's
 * own scorer only — see `src/features/statdash/eventQueue/` and `services/statdash/realtime.client.ts`):
 * the admin dashboard, fixture and tournament cards, the match detail page and the client portal. Without
 * this, a live score sat on screen exactly as it was when the page loaded until someone reloaded it.
 *
 * `refetch` is called through a ref so a caller can pass an inline arrow function without this effect
 * tearing the interval down and rebuilding it every render.
 */
export function useLivePoll(active: boolean, refetch: () => void, intervalMs = 10_000): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => refetchRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
}
