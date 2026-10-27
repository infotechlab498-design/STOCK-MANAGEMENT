/**
 * Centralized Frontend API Client
 * Features:
 * - Configurable base URL (/api/v1)
 * - Strict Bearer JWT attachment from active authenticated session
 * - Distinct handling for 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 408 (Timeout), 0 (Network), and 5xx (Server) errors
 * - Single-trigger unauthorized session invalidation hook to prevent infinite retry/redirect loops
 */

import { apiConfig } from './apiConfig';
import { ApiResponse, ApiError } from './types';

export class ApiClientException extends Error {
  public status: number;
  public details?: ApiError;
  public endpoint?: string;

  constructor(message: string, status: number, details?: ApiError, endpoint?: string) {
    super(message);
    this.name = 'ApiClientException';
    this.status = status;
    this.details = details;
    this.endpoint = endpoint;
  }
}

export const TOKEN_STORAGE_KEY = 'construct_stock_auth_token';
export const USER_STORAGE_KEY = 'construct_stock_auth_user';

/**
 * Validates that a token string is a well-formed, non-expired 3-part JWT.
 * Never accepts bypass tokens or expired tokens.
 */
export function isJwtTokenValid(rawToken: string | null | undefined): boolean {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }
  const trimmed = rawToken.trim();
  if (!trimmed || trimmed.startsWith('bypass-token')) {
    return false;
  }
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    if (!payload || typeof payload.sub !== 'string' || !payload.sub.trim()) {
      return false;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= nowSec + 5) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = (reason?: string) => void;

let currentTokenProvider: TokenProvider = () => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    return isJwtTokenValid(stored) ? stored!.trim() : null;
  }
  return null;
};

let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;

export function setAuthTokenProvider(provider: TokenProvider): void {
  currentTokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function getActiveAuthToken(): string | null {
  const raw = currentTokenProvider();
  if (isJwtTokenValid(raw)) {
    return raw!.trim();
  }
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (isJwtTokenValid(stored)) {
      return stored!.trim();
    }
  }
  return null;
}

function notifyUnauthorizedOnce(reason?: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  }
  if (unauthorizedHandler && !isHandlingUnauthorized) {
    isHandlingUnauthorized = true;
    try {
      unauthorizedHandler(reason);
    } finally {
      setTimeout(() => {
        isHandlingUnauthorized = false;
      }, 250);
    }
  }
}

export function resolveApiUrl(endpoint: string): { url: string; normalizedEndpoint: string } {
  const cleanEndpoint = endpoint
    .trim()
    .replace(/^\/api\/v1(?=\/|$)/i, '')
    .replace(/^\/api(?=\/|$)/i, '');
  const normalizedEndpoint = `/${cleanEndpoint.replace(/^\//, '')}`;
  const url = `${apiConfig.baseUrl.replace(/\/$/, '')}${normalizedEndpoint}`;
  return { url, normalizedEndpoint };
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { url, normalizedEndpoint } = resolveApiUrl(endpoint);
  const isLoginRequest = normalizedEndpoint.startsWith('/auth/login');

  const headers: Record<string, string> = {
    ...apiConfig.defaultHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!isLoginRequest) {
    const token = getActiveAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (typeof window !== 'undefined' && sessionStorage.getItem(TOKEN_STORAGE_KEY)) {
      // Stale or expired token found in session storage; clear and notify auth state
      notifyUnauthorizedOnce('Your session has expired. Please sign in again.');
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetails: ApiError | undefined;
      try {
        errorDetails = await response.json();
      } catch {
        // Response body is not JSON
      }

      const serverMessage =
        (errorDetails as any)?.message ||
        errorDetails?.detail ||
        errorDetails?.title;

      if (response.status === 401) {
        if (!isLoginRequest) {
          notifyUnauthorizedOnce(
            serverMessage || 'Unauthorized: Your session has expired or is invalid. Please sign in again.'
          );
        }
        throw new ApiClientException(
          serverMessage || 'Unauthorized: Token is expired or invalid',
          401,
          errorDetails,
          url
        );
      }

      if (response.status === 403) {
        throw new ApiClientException(
          serverMessage || 'Forbidden: You do not have permission to perform this action or access this scope.',
          403,
          errorDetails,
          url
        );
      }

      if (response.status === 404) {
        throw new ApiClientException(
          serverMessage || `Not Found: The requested resource (${normalizedEndpoint}) was not found.`,
          404,
          errorDetails,
          url
        );
      }

      throw new ApiClientException(
        serverMessage || `HTTP error ${response.status}: ${response.statusText}`,
        response.status,
        errorDetails,
        url
      );
    }

    if (response.status === 204) {
      return {
        success: true,
        data: null as unknown as T,
        timestampUtc: new Date().toISOString(),
      };
    }

    const json = await response.json();
    return json as ApiResponse<T>;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientException) {
      throw error;
    }

    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new ApiClientException('Request timeout after 30 seconds', 408, undefined, url);
    }

    throw new ApiClientException(
      err.message || 'Network request failed: Unable to reach the server.',
      0,
      undefined,
      url
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
