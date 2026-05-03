import { API_BASE } from '../../config';
import type { RealtimeSessionMessage } from './types';

const TOKEN_KEY = 'access_token';

export interface RealtimeClient {
  close: () => void;
}

export interface SessionRealtimeHandlers {
  onMessage: (message: RealtimeSessionMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (event: Event) => void;
  onError?: (event: Event) => void;
}

export function createSessionSseClient(
  sessionId: string,
  handlers: SessionRealtimeHandlers,
): RealtimeClient {
  const streamUrl = new URL(
    `${API_BASE}/statdash/realtime/sessions/${encodeURIComponent(sessionId)}/stream`,
  );
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    streamUrl.searchParams.set('access_token', token);
  }
  // Do not use withCredentials: auth is via query param, not cookies. Credentialed CORS is
  // stricter (ACAC + non-* ACAO) and often breaks cross-origin SSE on serverless/CDN.
  const eventSource = new EventSource(streamUrl.toString());

  eventSource.addEventListener('open', () => {
    handlers.onConnected?.();
  });

  eventSource.addEventListener('message', (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as RealtimeSessionMessage;
      handlers.onMessage(payload);
    } catch {
      // Ignore malformed realtime payloads.
    }
  });

  eventSource.addEventListener('error', (event) => {
    handlers.onError?.(event);
  });

  return {
    close: () => {
      eventSource.close();
      handlers.onDisconnected?.(new Event('close'));
    },
  };
}
