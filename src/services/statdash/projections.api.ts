import { statdashRequest } from './client';
import type {
  BoxScoreProjection,
  SessionSummaryProjection,
  ShotChartProjection,
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

  getSummary(sessionId: string): Promise<SessionSummaryProjection> {
    return statdashRequest<SessionSummaryProjection>(
      `/statdash/projections/match/${encodeURIComponent(sessionId)}/summary`,
    );
  },
};
