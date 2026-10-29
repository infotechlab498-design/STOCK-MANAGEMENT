import { apiClient } from './apiClient';
import { ApiResponse } from './types';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  projectScopes: string[];
  warehouseScopes: string[];
  lastLoginAtUtc?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

export interface LoginResponseData {
  /** Preferred JWT field returned by StructStock.Api */
  accessToken?: string;
  /** Legacy/compat alias (same JWT as accessToken) */
  token?: string;
  expiresInSeconds?: number;
  expiresAtUtc?: string;
  user: UserProfile;
}

/** Normalize login payload whether API returns accessToken or token. */
export function resolveAccessToken(data: LoginResponseData | null | undefined): string | null {
  if (!data) return null;
  const raw = (data.accessToken || data.token || '').trim();
  return raw || null;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
  userCount?: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  fullName: string;
  password: string;
  roles: string[];
  projectScopes?: string[];
  warehouseScopes?: string[];
}

export interface UpdateUserPayload {
  fullName: string;
  email: string;
  roles: string[];
  projectScopes?: string[];
  warehouseScopes?: string[];
}

export const authService = {
  login: async (usernameOrEmail: string, password: string): Promise<ApiResponse<LoginResponseData>> => {
    return apiClient.post<LoginResponseData>('auth/login', { usernameOrEmail, password });
  },

  logout: async (): Promise<ApiResponse<null>> => {
    return apiClient.post<null>('auth/logout');
  },

  getMe: async (): Promise<ApiResponse<UserProfile>> => {
    return apiClient.get<UserProfile>('auth/me');
  },

  getUsers: async (search?: string, role?: string, status?: string): Promise<ApiResponse<UserProfile[]>> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role && role !== 'ALL') params.append('role', role);
    if (status && status !== 'ALL') params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<UserProfile[]>(`users${query}`);
  },

  getUserById: async (id: string): Promise<ApiResponse<UserProfile>> => {
    return apiClient.get<UserProfile>(`users/${id}`);
  },

  createUser: async (payload: CreateUserPayload): Promise<ApiResponse<UserProfile>> => {
    return apiClient.post<UserProfile>('users', payload);
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<ApiResponse<UserProfile>> => {
    return apiClient.put<UserProfile>(`users/${id}`, payload);
  },

  updateUserStatus: async (id: string, isActive: boolean, reason?: string): Promise<ApiResponse<{ id: string; isActive: boolean }>> => {
    return apiClient.patch<{ id: string; isActive: boolean }>(`users/${id}/status`, { isActive, reason });
  },

  getRoles: async (): Promise<ApiResponse<RoleInfo[]>> => {
    return apiClient.get<RoleInfo[]>('roles');
  },
};
