import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Admin,
  AdminCreateBody,
  AdminUpdateBody,
  Statistician,
  StatisticianCreateBody,
  StatisticianUpdateBody,
  Player,
  PlayerCreateStandalone,
  PlayerCreateForTeam,
  PlayerBulkCreateRequest,
  PlayerUpdateBody,
  PlayerAssignToTeamBody,
  PlayerMergeBody,
  PlayerUploadResult,
  Team,
  TeamCreate,
  TeamUpdate,
  TeamSetCaptainBody,
  Tournament,
  TournamentCreate,
  TournamentUpdate,
  TournamentAddTeamsBody,
  Match,
  MatchCreate,
  MatchUpdate,
} from '../types/api';
import { ApiError } from '../types/api';
import { API_BASE } from '../config';
import { broadcastAuthSessionExpired } from '../auth/authSession';

const TOKEN_KEY = 'access_token';

function isPublicAuthEndpoint(endpoint: string): boolean {
  const path = endpoint.split('?')[0];
  return path === '/auth/login' || path === '/auth/register';
}

/** When a request included a Bearer token, 401 means session is dead — clear storage and notify router. */
function clearSessionIfUnauthorized(endpoint: string, status: number, hadAuth: boolean): void {
  if (status !== 401 || !hadAuth || isPublicAuthEndpoint(endpoint)) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('user_name');
  broadcastAuthSessionExpired();
}


class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string>),
      },
    };

    try {
      const response = await fetch(url, config);
      let data: { data?: T; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(endpoint, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Request failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: T }).data ?? (data as unknown as T),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  auth = {
    register: async (
      data: RegisterRequest
    ): Promise<ApiResponse<AuthResponse>> => {
      return this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    login: async (data: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
      return this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getProfile: async (): Promise<ApiResponse<{ id: string; email: string; role: string; [key: string]: unknown }>> => {
      return this.request('/auth/profile');
    },
  };

  /** POST /upload - multipart form field "file". Returns { url, public_id }. */
  upload = {
    file: async (file: File): Promise<ApiResponse<{ url: string; public_id?: string }>> => {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${API_BASE}/upload`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      let data: { data?: { url: string; public_id?: string }; url?: string; public_id?: string; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON
      }
      if (!response.ok) {
        clearSessionIfUnauthorized('/upload', response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Upload failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }
      const result = (data as { data?: { url: string; public_id?: string } }).data ?? (data as { url?: string; public_id?: string });
      const urlVal = result?.url ?? (data as { url?: string }).url;
      if (!urlVal) throw new ApiError('Upload response missing url', response.status, 'INVALID_RESPONSE');
      return {
        ok: true,
        data: { url: urlVal, public_id: result?.public_id ?? (data as { public_id?: string }).public_id },
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  players = {
    createStandalone: async (
      data: PlayerCreateStandalone
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    createForTeam: async (
      data: PlayerCreateForTeam
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players/team', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    bulkCreateForTeam: async (
      body: PlayerBulkCreateRequest
    ): Promise<ApiResponse<{ createdCount?: number; duplicatesCount?: number; [key: string]: unknown }>> => {
      return this.request('/players/team/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    getAll: async (params?: { teamId?: string; unassigned?: boolean }): Promise<ApiResponse<Player[]>> => {
      const sp = new URLSearchParams();
      if (params?.teamId) sp.set('teamId', params.teamId);
      if (params?.unassigned === true) sp.set('unassigned', 'true');
      const search = sp.toString() ? `?${sp.toString()}` : '';
      return this.request<Player[]>(`/players${search}`);
    },

    getById: async (id: string): Promise<ApiResponse<Player>> => {
      return this.request<Player>(`/players/${id}`);
    },

    update: async (
      id: string,
      data: PlayerUpdateBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>(`/players/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    assignToTeam: async (
      playerId: string,
      teamId: string,
      body?: PlayerAssignToTeamBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>(
        `/players/${playerId}/teams/${teamId}`,
        {
          method: 'PUT',
          body: JSON.stringify(body ?? {}),
        }
      );
    },

    removeFromTeam: async (
      playerId: string,
      teamId: string
    ): Promise<boolean> => {
      await this.request(`/players/${playerId}/teams/${teamId}`, {
        method: 'DELETE',
      });
      return true;
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/players/${id}`, { method: 'DELETE' });
      return true;
    },

    uploadExcel: async (
      teamId: string,
      file: File
    ): Promise<ApiResponse<PlayerUploadResult>> => {
      const formData = new FormData();
      formData.append('file', file);

      const url = `${API_BASE}/players/team/${teamId}/upload`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // Do not set Content-Type - browser sets multipart/form-data with boundary

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      let data: { data?: PlayerUploadResult; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/players/team/${teamId}/upload`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Upload failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: PlayerUploadResult }).data ?? (data as unknown as PlayerUploadResult),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },

    merge: async (
      body: PlayerMergeBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players/merge', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };

  teams = {
    create: async (data: TeamCreate): Promise<ApiResponse<Team>> => {
      return this.request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (params?: { tournamentId?: string }): Promise<ApiResponse<Team[]>> => {
      const search = params?.tournamentId
        ? `?tournamentId=${encodeURIComponent(params.tournamentId)}`
        : '';
      return this.request<Team[]>(`/teams${search}`);
    },

    getById: async (id: string): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${id}`);
    },

    update: async (
      id: string,
      data: TeamUpdate
    ): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/teams/${id}`, { method: 'DELETE' });
      return true;
    },

    setCaptain: async (
      teamId: string,
      playerId: string,
      data: TeamSetCaptainBody
    ): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${teamId}/players/${playerId}/captain`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  };

  tournaments = {
    create: async (
      data: TournamentCreate
    ): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (): Promise<ApiResponse<Tournament[]>> => {
      return this.request<Tournament[]>('/tournaments');
    },

    getById: async (id: string): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/${id}`);
    },

    getByCode: async (code: string): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/code/${encodeURIComponent(code)}`);
    },

    update: async (
      id: string,
      data: TournamentUpdate
    ): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    addTeams: async (
      tournamentId: string,
      body: TournamentAddTeamsBody
    ): Promise<ApiResponse<unknown>> => {
      return this.request(`/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    removeTeam: async (
      tournamentId: string,
      teamId: string
    ): Promise<boolean> => {
      await this.request(
        `/tournaments/${tournamentId}/teams/${teamId}`,
        { method: 'DELETE' }
      );
      return true;
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/tournaments/${id}`, { method: 'DELETE' });
      return true;
    },

    /** PATCH /tournaments/:id/flyer - multipart form field "flyer". Returns updated Tournament with flyer URL. */
    uploadFlyer: async (
      id: string,
      file: File
    ): Promise<ApiResponse<Tournament>> => {
      const formData = new FormData();
      formData.append('flyer', file);

      const url = `${API_BASE}/tournaments/${id}/flyer`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      let data: { data?: Tournament; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/tournaments/${id}/flyer`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Failed to upload flyer',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: Tournament }).data ?? (data as unknown as Tournament),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  matches = {
    create: async (data: MatchCreate): Promise<ApiResponse<Match>> => {
      return this.request<Match>('/matches', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (params?: {
      tournamentId?: string;
      status?: string;
    }): Promise<ApiResponse<Match[]>> => {
      const search = new URLSearchParams();
      if (params?.tournamentId) search.set('tournamentId', params.tournamentId);
      if (params?.status) search.set('status', params.status);
      const qs = search.toString();
      return this.request<Match[]>(`/matches${qs ? `?${qs}` : ''}`);
    },

    getById: async (id: string): Promise<ApiResponse<Match>> => {
      return this.request<Match>(`/matches/${id}`);
    },

    update: async (
      id: string,
      data: MatchUpdate
    ): Promise<ApiResponse<Match>> => {
      return this.request<Match>(`/matches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/matches/${id}`, { method: 'DELETE' });
      return true;
    },
  };

  admin = {
    create: async (data: AdminCreateBody): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>('/admin', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (): Promise<ApiResponse<Admin[]>> => {
      return this.request<Admin[]>('/admin');
    },

    getById: async (id: string): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>(`/admin/${id}`);
    },

    update: async (
      id: string,
      data: AdminUpdateBody
    ): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>(`/admin/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/admin/${id}`, { method: 'DELETE' });
      return true;
    },
  };

  statistician = {
    create: async (
      data: StatisticianCreateBody
    ): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>('/statistician', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (): Promise<ApiResponse<Statistician[]>> => {
      return this.request<Statistician[]>('/statistician');
    },

    getById: async (id: string): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>(`/statistician/${id}`);
    },

    update: async (
      id: string,
      data: StatisticianUpdateBody
    ): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>(`/statistician/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/statistician/${id}`, { method: 'DELETE' });
      return true;
    },

    /** PATCH /statistician/:id/photo - multipart form field "photo". Returns updated Statistician with photo URL. */
    uploadPhoto: async (
      id: string,
      file: File
    ): Promise<ApiResponse<Statistician>> => {
      const formData = new FormData();
      formData.append('photo', file);

      const url = `${API_BASE}/statistician/${id}/photo`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      let data: { data?: Statistician; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/statistician/${id}/photo`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Failed to upload statistician photo',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: Statistician }).data ?? (data as unknown as Statistician),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  ops = {
    getHealth: async (): Promise<{
      enabled: boolean;
      queues: Record<string, { active?: number; waiting?: number; completed?: number; failed?: number; delayed?: number; paused?: number }>;
    }> => {
      const res = await this.request<{ enabled: boolean; queues: Record<string, Record<string, number>> }>('/ops/queues/health');
      return res.data!;
    },

    getLag: async (): Promise<{
      enabled: boolean;
      lag: Record<string, { waiting: number; oldestWaitingMs: number }>;
    }> => {
      const res = await this.request<{ enabled: boolean; lag: Record<string, { waiting: number; oldestWaitingMs: number }> }>('/ops/queues/lag');
      return res.data!;
    },

    requeueDeadLetter: async (limit = 25): Promise<{ requeued: number }> => {
      const res = await this.request<{ requeued: number }>(`/ops/queues/dead-letter/requeue?limit=${limit}`, { method: 'POST' });
      return res.data!;
    },

    warmSession: async (sessionId: string): Promise<{ warmed: boolean; sessionId: string }> => {
      const res = await this.request<{ warmed: boolean; sessionId: string }>(`/ops/queues/warm/session?sessionId=${encodeURIComponent(sessionId)}`, { method: 'POST' });
      return res.data!;
    },
  };
}

export const apiClient = new ApiClient();
