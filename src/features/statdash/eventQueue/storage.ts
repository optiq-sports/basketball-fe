import type { QueuedEvent } from './types';

const STORAGE_KEY = 'statdash_event_queue_v1';
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

export function loadQueue(): QueuedEvent[] {
  if (!hasLocalStorage()) return [...memoryQueue];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
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
