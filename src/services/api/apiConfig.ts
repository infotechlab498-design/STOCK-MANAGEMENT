/**
 * API Configuration
 * Supports configurable base URL via environment variable with fallback.
 */

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
}

export const apiConfig: ApiConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1',
  timeoutMs: 30000,
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};
