import { statdashRequest } from './client';
import type {
  BoxScoreProjection,
  PlayerGameProjection,
  SessionSummaryProjection,
  ShotChartProjection,
  TimelineEvent,
} from './types';

export const projectionsApi = {
  getBoxScore(sessionId: string): Promise<BoxScoreProjection> {
    return statdashRequest<BoxScoreProjection>(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/box-score`,
    );
  },

  getShotChart(sessionId: string): Promise<ShotChartProjection[]> {
    return statdashRequest<ShotChartProjection[]>(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/shot-chart`,
    );
  },

  /** Every recorded play in order, with the running score. Not on the backend yet (Gap 53): a 404 means that. */
  getTimeline(sessionId: string): Promise<TimelineEvent[]> {
    return statdashRequest<TimelineEvent[]>(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/timeline`,
    );
  },

  /** Live per-player line for one game; all zeros (not an error) if the player has no events yet. */
  getPlayerGame(sessionId: string, playerId: string): Promise<PlayerGameProjection> {
    return statdashRequest<PlayerGameProjection>(
      `/statdash/projections/player/${encodeURIComponent(playerId)}/game/${encodeURIComponent(sessionId)}`,
    );
  },

  getSummary(sessionId: string): Promise<SessionSummaryProjection> {
    return statdashRequest<SessionSummaryProjection>(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/summary`,
    );
  },

  rebuild(sessionId: string): Promise<{ sessionId: string; version: number; score: { home: number; away: number }; projectionId: string }> {
    return statdashRequest(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/rebuild`,
      { method: 'POST' },
    );
  },
};
