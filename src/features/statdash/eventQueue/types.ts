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
  /** See CommandEnvelope.parentEventId (services/statdash/types.ts). */
  parentEventId?: string;
  /**
   * What this entry does. Ordinary game commands are the default. 'reverse' and 'correct' undo or
   * amend an earlier event and travel through the same ordered queue, so the statistician can undo
   * a play instantly and the undo simply runs once the play it targets has been sent — nothing
   * ever has to wait for a sync before it can be issued.
   */
  kind?: 'command' | 'reverse' | 'correct';
  /** reverse/correct: the queued command being undone or amended (resolved to its real event id
   * when this entry is sent). */
  targetLocalId?: string;
  /** reverse/correct: the real event id, when it is already known (e.g. a play restored after a
   * reload, which is no longer in the queue). */
  targetBackendEventId?: string;
  /** correct: the fields to change on the target event. */
  correctedPayload?: Record<string, unknown>;
  /** reverse/correct: the reason recorded against the change. */
  reason?: string;
  /** Set once the server accepts a command: ids of the events it created. */
  backendEventIds?: string[];
  /** This command belongs to another queued command (a free throw to its foul). The parent's real
   * event id is filled in as parentEventId when this one is sent, so the link is made even if the
   * parent hadn't finished syncing when this was recorded. */
  parentLocalId?: string;
}
