export type QueuedEventStatus = 'pending' | 'inflight' | 'sent' | 'failed';

export interface QueuedEvent {
  localId: string;
  sessionId: string;
  commandType: string;
  payload: Record<string, unknown>;
  expectedVersion: number;
  enqueuedAt: number;
  status: QueuedEventStatus;
  attempts: number;
  lastError?: string;
}
