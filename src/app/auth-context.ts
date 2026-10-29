import { createContext } from 'react';
import type { UserProfile } from '../services/api/authService';

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRoleProfile: (emailKey: string) => Promise<void>;
  clearError: () => void;
  hasRole: (roles: string | string[]) => boolean;
  isProjectAuthorized: (projectId: string) => boolean;
  isWarehouseAuthorized: (warehouseId: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
