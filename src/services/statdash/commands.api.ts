import { statdashRequest } from './client';
import type {
  CommandAcceptedResponse,
  CommandEnvelope,
  SessionStateSnapshot,
} from './types';

export interface CorrectEventRequest {
  reason: string;
  correctedPayload: Record<string, unknown>;
}

export interface ReverseEventRequest {
  reason: string;
}

export interface EventReconciliationResponse {
  sessionId: string;
  version: number;
  score: {
    home: number;
    away: number;
  };
  correctedEventId?: string;
  reversedEventId?: string;
}

export const commandsApi = {
  sendCommand<TPayload>(command: CommandEnvelope<TPayload>): Promise<CommandAcceptedResponse> {
    return statdashRequest<CommandAcceptedResponse>('/statdash/events/command', {
      method: 'POST',
      body: JSON.stringify(command),
    });
  },

  correctEvent(eventId: string, request: CorrectEventRequest): Promise<EventReconciliationResponse> {
    return statdashRequest<EventReconciliationResponse>(
      `/statdash/events/${encodeURIComponent(eventId)}/correct`,
      {
        method: 'PATCH',
        body: JSON.stringify(request),
      },
    );
  },

  reverseEvent(eventId: string, request: ReverseEventRequest): Promise<EventReconciliationResponse> {
    return statdashRequest<EventReconciliationResponse>(
      `/statdash/events/${encodeURIComponent(eventId)}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  },
};
