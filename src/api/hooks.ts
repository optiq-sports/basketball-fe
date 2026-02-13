import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from './ApiClient';
import type {
  LoginRequest,
  RegisterRequest,
  AdminCreateBody,
  AdminUpdateBody,
  StatisticianCreateBody,
  StatisticianUpdateBody,
  PlayerCreateStandalone,
  PlayerCreateForTeam,
  PlayerBulkCreateRequest,
  PlayerUpdateBody,
  PlayerAssignToTeamBody,
  PlayerMergeBody,
  TeamCreate,
  TeamUpdate,
  TournamentCreate,
  TournamentUpdate,
  TournamentAddTeamsBody,
  MatchCreate,
  MatchUpdate,
} from '../types/api';

const TOKEN_KEY = 'access_token';

// Query keys
export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  players: (teamId?: string) =>
    (teamId ? (['players', teamId] as readonly string[]) : ['players']) as readonly string[],
  player: (id: string) => ['player', id] as const,
  teams: () => ['teams'] as const,
  team: (id: string) => ['team', id] as const,
  tournaments: () => ['tournaments'] as const,
  tournament: (id: string) => ['tournament', id] as const,
  tournamentByCode: (code: string) => ['tournament', 'code', code] as const,
  matches: (tournamentId?: string, status?: string) =>
    (tournamentId || status
      ? (['matches', tournamentId, status].filter(Boolean) as readonly string[])
      : ['matches']) as readonly string[],
  match: (id: string) => ['match', id] as const,
  admins: () => ['admins'] as const,
  admin: (id: string) => ['admin', id] as const,
  statisticians: () => ['statisticians'] as const,
  statistician: (id: string) => ['statistician', id] as const,
};

// Auth hooks
export function useProfile(enabled = true) {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY);
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => {
      const res = await apiClient.auth.getProfile();
      if (!res.ok || res.data === undefined) throw new Error(res.message ?? 'Failed to load profile');
      return res.data;
    },
    enabled: enabled && hasToken,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await apiClient.auth.login(data);
      if (!res.ok) throw new Error(res.message ?? 'Login failed');
      return res;
    },
    onSuccess: (res) => {
      const token = res.data?.access_token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        queryClient.setQueryData(queryKeys.auth.profile, res.data?.user ?? null);
      }
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const res = await apiClient.auth.register(data);
      if (!res.ok) throw new Error(res.message ?? 'Register failed');
      return res;
    },
    onSuccess: (res) => {
      const token = res.data?.access_token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        queryClient.setQueryData(queryKeys.auth.profile, res.data?.user ?? null);
      }
    },
  });
}

// Note: Users API is not included in the Basketball Management API (Postman collection).
// User management hooks have been removed. Use auth/profile for current user only.

// Player hooks
export function usePlayers(teamId?: string) {
  return useQuery({
    queryKey: queryKeys.players(teamId),
    queryFn: async () => {
      const res = await apiClient.players.getAll(teamId ? { teamId } : undefined);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load players');
      return res.data ?? [];
    },
  });
}

export function usePlayer(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.player(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.players.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load player');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreatePlayerStandalone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerCreateStandalone) => {
      const res = await apiClient.players.createStandalone(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create player');
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

export function useCreatePlayerForTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerCreateForTeam) => {
      const res = await apiClient.players.createForTeam(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create player');
      return res.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.players() });
      queryClient.invalidateQueries({ queryKey: queryKeys.players(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(variables.teamId) });
    },
  });
}

export function useBulkCreatePlayersForTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerBulkCreateRequest) => {
      const res = await apiClient.players.bulkCreateForTeam(data);
      if (!res.ok) throw new Error(res.message ?? 'Bulk create failed');
      return res.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.players() });
      queryClient.invalidateQueries({ queryKey: queryKeys.players(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(variables.teamId) });
    },
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: PlayerUpdateBody }) => {
      const res = await apiClient.players.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update player');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(data.id) });
      if (data.teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.players(data.teamId as string) });
        queryClient.invalidateQueries({ queryKey: queryKeys.team(data.teamId as string) });
      }
    },
  });
}

export function useAssignPlayerToTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playerId,
      teamId,
      body,
    }: {
      playerId: string;
      teamId: string;
      body?: PlayerAssignToTeamBody;
    }) => {
      const res = await apiClient.players.assignToTeam(playerId, teamId, body);
      if (!res.ok) throw new Error(res.message ?? 'Failed to assign player');
      return res.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.players(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(variables.playerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(variables.teamId) });
    },
  });
}

export function useRemovePlayerFromTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playerId,
      teamId,
    }: { playerId: string; teamId: string }) => {
      await apiClient.players.removeFromTeam(playerId, teamId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.players(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(variables.playerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(variables.teamId) });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.players.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(id) });
    },
  });
}

export function useUploadPlayersExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      file,
    }: { teamId: string; file: File }) => {
      const res = await apiClient.players.uploadExcel(teamId, file);
      if (!res.ok) throw new Error(res.message ?? 'Upload failed');
      return res.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.players(variables.teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(variables.teamId) });
    },
  });
}

export function useMergePlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PlayerMergeBody) => {
      const res = await apiClient.players.merge(body);
      if (!res.ok) throw new Error(res.message ?? 'Merge failed');
      return res.data!;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(variables.duplicatePlayerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(variables.targetPlayerId) });
    },
  });
}

// Team hooks
export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams(),
    queryFn: async () => {
      const res = await apiClient.teams.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load teams');
      return res.data ?? [];
    },
  });
}

export function useTeam(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.team(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.teams.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load team');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TeamCreate) => {
      const res = await apiClient.teams.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create team');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams() });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(data.id) });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeamUpdate }) => {
      const res = await apiClient.teams.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update team');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams() });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(data.id) });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.teams.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams() });
      queryClient.invalidateQueries({ queryKey: queryKeys.team(id) });
    },
  });
}

// Tournament hooks
export function useTournaments() {
  return useQuery({
    queryKey: queryKeys.tournaments(),
    queryFn: async () => {
      const res = await apiClient.tournaments.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournaments');
      return res.data ?? [];
    },
  });
}

export function useTournament(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournament(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.tournaments.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournament');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useTournamentByCode(code: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournamentByCode(code ?? ''),
    queryFn: async () => {
      const res = await apiClient.tournaments.getByCode(code!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournament');
      return res.data!;
    },
    enabled: enabled && !!code,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TournamentCreate) => {
      const res = await apiClient.tournaments.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create tournament');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(data.id) });
    },
  });
}

export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: TournamentUpdate }) => {
      const res = await apiClient.tournaments.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update tournament');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(data.id) });
    },
  });
}

export function useTournamentAddTeams() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      body,
    }: { tournamentId: string; body: TournamentAddTeamsBody }) => {
      await apiClient.tournaments.addTeams(tournamentId, body);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(variables.tournamentId) });
    },
  });
}

export function useTournamentRemoveTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      teamId,
    }: { tournamentId: string; teamId: string }) => {
      await apiClient.tournaments.removeTeam(tournamentId, teamId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(variables.tournamentId) });
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.tournaments.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tournaments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tournament(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(id) });
    },
  });
}

// Match hooks
export function useMatches(tournamentId?: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.matches(tournamentId, status),
    queryFn: async () => {
      const res = await apiClient.matches.getAll(
        tournamentId || status ? { tournamentId, status } : undefined
      );
      if (!res.ok) throw new Error(res.message ?? 'Failed to load matches');
      return res.data ?? [];
    },
  });
}

export function useMatch(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.match(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.matches.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load match');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: MatchCreate) => {
      const res = await apiClient.matches.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create match');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(data.tournamentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.match(data.id) });
    },
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MatchUpdate }) => {
      const res = await apiClient.matches.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update match');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches(data.tournamentId as string) });
      queryClient.invalidateQueries({ queryKey: queryKeys.match(data.id) });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.matches.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.match(id) });
    },
  });
}

// Admin hooks
export function useAdmins() {
  return useQuery({
    queryKey: queryKeys.admins(),
    queryFn: async () => {
      const res = await apiClient.admin.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load admins');
      return res.data ?? [];
    },
  });
}

export function useAdmin(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.admin.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load admin');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AdminCreateBody) => {
      const res = await apiClient.admin.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create admin');
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins() });
    },
  });
}

export function useUpdateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: AdminUpdateBody }) => {
      const res = await apiClient.admin.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update admin');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin(data.id) });
    },
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.admin.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admins() });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin(id) });
    },
  });
}

// Statistician hooks
export function useStatisticians() {
  return useQuery({
    queryKey: queryKeys.statisticians(),
    queryFn: async () => {
      const res = await apiClient.statistician.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load statisticians');
      return res.data ?? [];
    },
  });
}

export function useStatistician(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.statistician(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.statistician.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load statistician');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: StatisticianCreateBody) => {
      const res = await apiClient.statistician.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create statistician');
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statisticians() });
    },
  });
}

export function useUpdateStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: StatisticianUpdateBody }) => {
      const res = await apiClient.statistician.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update statistician');
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statisticians() });
      queryClient.invalidateQueries({ queryKey: queryKeys.statistician(data.id) });
    },
  });
}

export function useDeleteStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.statistician.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.statisticians() });
      queryClient.invalidateQueries({ queryKey: queryKeys.statistician(id) });
    },
  });
}
