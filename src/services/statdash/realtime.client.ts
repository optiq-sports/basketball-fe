import { API_BASE } from '../../config';
import type { RealtimeSessionMessage } from './types';

const TOKEN_KEY = 'access_token';

/** Backoff between our own reconnect attempts. Doubles from the first to the cap, with jitter. */
const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export interface RealtimeClient {
  close: () => void;
}

export interface SessionRealtimeHandlers {
  onMessage: (message: RealtimeSessionMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (event: Event) => void;
  onError?: (event: Event) => void;
}

export interface SessionRealtimeOptions {
  /** Resume point for the first connection. Later reconnects use the highest version actually seen. */
  sinceVersion?: number;
}

/**
 * The session event stream.
 *
 * **On reconnection.** `EventSource` retries on its own after a dropped connection, and that covers the
 * ordinary case, including a stream cut short by a serverless function timing out. What it does not do
 * is retry once it has given up: a non-2xx response, the wrong content type or a failed handshake put it
 * in `CLOSED`, where it stays for good. Until now nothing noticed, so a statistician whose token expired
 * mid-game sat on a stream that would never come back, and an on-air overlay would hold a frozen
 * graphic. This client now watches for `CLOSED` and rebuilds the connection itself, backing off from one
 * second to thirty with jitter, so a backend that is down for a minute does not get hammered.
 *
 * **On resuming.** Each reconnect asks for `sinceVersion` set to the highest version this client has
 * actually seen, so the gap is replayed rather than skipped. StatDash also refetches session state in
 * `onConnected`, which has been covering this; the resume makes the stream correct on its own, which an
 * overlay needs because it has no session state to fall back on.
 *
 * The token still travels as a query parameter because `EventSource` cannot set an Authorization header.
 * `jwt.strategy.ts` reads it from there deliberately.
 */
export function createSessionSseClient(
  sessionId: string,
  handlers: SessionRealtimeHandlers,
  options: SessionRealtimeOptions = {},
): RealtimeClient {
  let eventSource: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = FIRST_RETRY_MS;
  let lastVersion = options.sinceVersion;
  let closed = false;

  const buildUrl = () => {
    const url = new URL(
      `${API_BASE}/statdash/realtime/sessions/${encodeURIComponent(sessionId)}/stream`,
    );
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) url.searchParams.set('access_token', token);
    if (typeof lastVersion === 'number') url.searchParams.set('sinceVersion', String(lastVersion));
    return url.toString();
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;
    // Jitter keeps many overlays and dashboards from retrying in lockstep after a backend restart.
    const wait = retryDelay + Math.floor(Math.random() * 250);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      connect();
    }, wait);
  };

  function connect() {
    if (closed) return;

    // Do not use withCredentials: auth is via query param, not cookies. Credentialed CORS is
    // stricter (ACAC + non-* ACAO) and often breaks cross-origin SSE on serverless/CDN.
    const source = new EventSource(buildUrl());
    eventSource = source;

    source.addEventListener('open', () => {
      retryDelay = FIRST_RETRY_MS;
      handlers.onConnected?.();
    });

    source.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as RealtimeSessionMessage;
        // The version rides on `state`, and a reconnect resumes from the highest one seen.
        const version = payload.state?.version;
        if (typeof version === 'number' && (lastVersion === undefined || version > lastVersion)) {
          lastVersion = version;
        }
        handlers.onMessage(payload);
      } catch {
        // Ignore malformed realtime payloads.
      }
    });

    source.addEventListener('error', (event) => {
      handlers.onError?.(event);
      // CLOSED means EventSource has stopped retrying and will not come back by itself.
      // Any other state is its own retry in progress, which needs no help from us.
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        if (eventSource === source) eventSource = null;
        scheduleReconnect();
      }
    });
  }

  connect();

  return {
    close: () => {
      closed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      eventSource?.close();
      eventSource = null;
      handlers.onDisconnected?.(new Event('close'));
    },
  };
}
