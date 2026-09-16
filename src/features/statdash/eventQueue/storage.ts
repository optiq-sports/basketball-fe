import type { QueuedEvent } from './types';

const STORAGE_KEY_BASE = 'statdash_event_queue_v1';
// Same key sessionContextStorage.ts writes sessionId under — read directly rather
// than importing, to keep this module dependency-free and usable from anywhere.
const SESSION_ID_KEY = 'statdash_session_id';
let memoryQueue: QueuedEvent[] = [];

function hasLocalStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const key = '__statdash_queue_probe__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Scoped per session — this used to be one global key shared across every game a
// statistician ever played on this browser, so a 'failed' or stuck 'pending' entry
// from a completely different (often long-finished) session would silently persist
// forever and show up as an alarming, meaningless "N failed" count on a brand-new
// game. Falls back to the unscoped key only if no session is active yet (rare: a
// component mounting before sessionContextStorage has written it).
function queueStorageKey(): string {
  try {
    const sessionId =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(SESSION_ID_KEY)
        : null;
    return sessionId ? `${STORAGE_KEY_BASE}_${sessionId}` : STORAGE_KEY_BASE;
  } catch {
    return STORAGE_KEY_BASE;
  }
}

export function loadQueue(): QueuedEvent[] {
  if (!hasLocalStorage()) return [...memoryQueue];
  try {
    const raw = localStorage.getItem(queueStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [...memoryQueue];
  }
}

export function saveQueue(queue: QueuedEvent[]): void {
  memoryQueue = [...queue];
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(queueStorageKey(), JSON.stringify(queue));
  } catch {
    // Gracefully degrade to memory-only mode.
  }
}

export function clearSentEvents(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const next = loadQueue().filter((event) => {
    if (event.status !== 'sent') return true;
    return event.enqueuedAt >= cutoff;
  });
  saveQueue(next);
}
