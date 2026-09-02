import { API_BASE } from '../../config';
import { broadcastAuthSessionExpired, clearAuthTokens, refreshAccessToken } from '../../auth/authSession';

const TOKEN_KEY = 'access_token';

export class StatDashApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'StatDashApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  code?: string;
  details?: unknown;
}

async function performFetch<TResponse>(
  endpoint: string,
  init: RequestInit,
  token: string | null,
): Promise<{ response: Response; payload: ApiEnvelope<TResponse> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${endpoint}`, { ...init, headers });
  let payload: ApiEnvelope<TResponse> = {};
  try {
    payload = (await response.json()) as ApiEnvelope<TResponse>;
  } catch {
    // Intentionally ignore non-JSON responses.
  }
  return { response, payload };
}

export async function statdashRequest<TResponse>(
  endpoint: string,
  init: RequestInit = {},
): Promise<TResponse> {
  let token = localStorage.getItem(TOKEN_KEY);
  let { response, payload } = await performFetch<TResponse>(endpoint, init, token);

  // Access token expired mid-session — try a silent refresh and retry once before giving up,
  // same pattern as ApiClient.ts (see refreshAccessToken in src/auth/authSession.ts for why
  // this doesn't just call apiClient.auth.refresh()).
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      token = newToken;
      ({ response, payload } = await performFetch<TResponse>(endpoint, init, token));
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAuthTokens();
      broadcastAuthSessionExpired();
    }
    throw new StatDashApiError(
      payload.message ?? 'StatDash request failed',
      response.status,
      payload.code,
      payload.details,
    );
  }

  return (payload.data ?? (payload as unknown as TResponse)) as TResponse;
}
