import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commandsApi } from './commands.api';
import { projectionsApi } from './projections.api';
import { sessionsApi } from './sessions.api';
import type { CommandEnvelope, CommandAcceptedResponse } from './types';

export const statdashQueryKeys = {
  sessionState: (sessionId: string) => ['statdash', 'session', sessionId, 'state'] as const,
  bootstrap: (sessionId: string) => ['statdash', 'session', sessionId, 'bootstrap'] as const,
  boxScore: (sessionId: string) => ['statdash', 'session', sessionId, 'projection', 'boxScore'] as const,
  shotChart: (sessionId: string) => ['statdash', 'session', sessionId, 'projection', 'shotChart'] as const,
  summary: (sessionId: string) => ['statdash', 'session', sessionId, 'projection', 'summary'] as const,
};

export function useSessionStateQuery(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: statdashQueryKeys.sessionState(sessionId ?? ''),
    queryFn: () => sessionsApi.getSessionState(sessionId!),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 3,
    refetchInterval: enabled && !!sessionId ? 1000 * 8 : false,
  });
}

export function useSessionBootstrapQuery(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: statdashQueryKeys.bootstrap(sessionId ?? ''),
    queryFn: () => sessionsApi.bootstrapSession({ sessionId: sessionId! }),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 3,
  });
}

export function useBoxScoreProjection(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: statdashQueryKeys.boxScore(sessionId ?? ''),
    queryFn: () => projectionsApi.getBoxScore(sessionId!),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 5,
  });
}

export function useShotChartProjection(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: statdashQueryKeys.shotChart(sessionId ?? ''),
    queryFn: () => projectionsApi.getShotChart(sessionId!),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 5,
  });
}

export function useSummaryProjection(sessionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: statdashQueryKeys.summary(sessionId ?? ''),
    queryFn: () => projectionsApi.getSummary(sessionId!),
    enabled: enabled && !!sessionId,
    staleTime: 1000 * 5,
  });
}

export function useSendStatDashCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async <TPayload,>(envelope: CommandEnvelope<TPayload>) => {
      return commandsApi.sendCommand(envelope);
    },
    onSuccess: (response: CommandAcceptedResponse) => {
      queryClient.setQueryData(statdashQueryKeys.sessionState(response.sessionId), (prev: unknown) => {
        if (typeof prev === 'object' && prev !== null && 'score' in prev) {
          return {
            ...(prev as Record<string, unknown>),
            score: response.score,
            version: response.version,
          };
        }
        if (typeof prev === 'object' && prev !== null && 'state' in prev) {
          return {
            ...(prev as Record<string, unknown>),
            state: {
              ...((prev as { state?: Record<string, unknown> }).state ?? {}),
              score: response.score,
              version: response.version,
            },
          };
        }
        return prev;
      });
      queryClient.invalidateQueries({
        queryKey: ['statdash', 'session', response.sessionId, 'projection'],
      });
    },
  });
}
