import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Player,
  PlayerCreateStandalone,
  PlayerCreateForTeam,
  PlayerBulkCreateRequest,
  PlayerUpdateBody,
  PlayerAssignToTeamBody,
  Team,
  TeamCreate,
  TeamUpdate,
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

const TOKEN_KEY = 'access_token';

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

    getAll: async (params?: { teamId?: string }): Promise<ApiResponse<Player[]>> => {
      const search = params?.teamId
        ? `?teamId=${encodeURIComponent(params.teamId)}`
        : '';
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
  };

  teams = {
    create: async (data: TeamCreate): Promise<ApiResponse<Team>> => {
      return this.request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getAll: async (): Promise<ApiResponse<Team[]>> => {
      return this.request<Team[]>('/teams');
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
}

export const apiClient = new ApiClient();
