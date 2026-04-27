import { API_BASE } from '../../config';

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

export async function statdashRequest<TResponse>(
  endpoint: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers,
  });

  let payload: ApiEnvelope<TResponse> = {};
  try {
    payload = (await response.json()) as ApiEnvelope<TResponse>;
  } catch {
    // Intentionally ignore non-JSON responses.
  }

  if (!response.ok) {
    throw new StatDashApiError(
      payload.message ?? 'StatDash request failed',
      response.status,
      payload.code,
      payload.details,
    );
  }

  return (payload.data ?? (payload as unknown as TResponse)) as TResponse;
}
