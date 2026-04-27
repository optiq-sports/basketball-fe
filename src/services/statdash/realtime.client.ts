import { API_BASE } from '../../config';
import type { RealtimeSessionMessage } from './types';

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
  const eventSource = new EventSource(streamUrl.toString(), { withCredentials: true });

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
