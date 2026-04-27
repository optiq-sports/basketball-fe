import { statdashRequest } from './client';
import type {
  ResolveSessionRequest,
  ResolveSessionResponse,
  SessionBootstrapRequest,
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

  startSession(sessionId: string): Promise<{
    id: string;
    status: string;
    startedAt?: string | Date | null;
  }> {
    return statdashRequest<{ id: string; status: string; startedAt?: string | Date | null }>(
      `/statdash/sessions/${encodeURIComponent(sessionId)}/start`,
      { method: 'POST' },
    );
  },
};
