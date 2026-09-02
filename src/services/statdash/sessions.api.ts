import { statdashRequest } from './client';
import type {
  ResolveSessionRequest,
  ResolveSessionResponse,
  SessionBootstrapRequest,
  SessionLifecycleResponse,
  SessionStateSnapshot,
} from './types';

export const sessionsApi = {
  resolveSession(body: ResolveSessionRequest): Promise<ResolveSessionResponse> {
    return statdashRequest<ResolveSessionResponse>('/statdash/sessions/resolve-match-key', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  bootstrapSession(body: SessionBootstrapRequest): Promise<SessionStateSnapshot> {
    return statdashRequest<SessionStateSnapshot>('/statdash/sessions/bootstrap', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getSessionState(sessionId: string): Promise<SessionStateSnapshot> {
    return statdashRequest<SessionStateSnapshot>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/state`,
    );
  },

  startSession(sessionId: string): Promise<SessionLifecycleResponse> {
    return statdashRequest<SessionLifecycleResponse>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/start`,
      { method: 'POST' },
    );
  },

  /** Pauses an IN_PROGRESS session (e.g. halftime, a long break) — backend rejects any other status. */
  pauseSession(sessionId: string): Promise<SessionLifecycleResponse> {
    return statdashRequest<SessionLifecycleResponse>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/pause`,
      { method: 'POST' },
    );
  },

  /** Marks the session COMPLETED and the match COMPLETED. Terminal — cannot be resumed after. */
  completeSession(sessionId: string): Promise<SessionLifecycleResponse> {
    return statdashRequest<SessionLifecycleResponse>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/complete`,
      { method: 'POST' },
    );
  },

  /** Marks the session CANCELLED and the match CANCELLED. Terminal — cannot be resumed after. */
  cancelSession(sessionId: string): Promise<SessionLifecycleResponse> {
    return statdashRequest<SessionLifecycleResponse>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: 'POST' },
    );
  },
};
