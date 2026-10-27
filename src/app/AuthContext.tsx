import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, UserProfile } from '../services/api/authService';
import { setAuthTokenProvider, ApiClientException } from '../services/api/apiClient';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  hasRole: (roles: string | string[]) => boolean;
  isProjectAuthorized: (projectId: string) => boolean;
  isWarehouseAuthorized: (warehouseId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'construct_stock_auth_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Configure centralized API client token provider
  useEffect(() => {
    setAuthTokenProvider(() => token);
  }, [token]);

  // Initial session validation via /api/auth/me
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        setToken(storedToken);
        const res = await authService.getMe();
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      } catch {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (usernameOrEmail: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.login(usernameOrEmail, password);
      if (res.success && res.data) {
        const { accessToken, user: userProfile } = res.data;
        sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        setToken(accessToken);
        setUser(userProfile);
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setError(err.message || 'Invalid email or password');
      } else {
        setError((err as Error).message || 'Authentication error');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (token) {
        await authService.logout().catch(() => {});
      }
    } finally {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    const required = Array.isArray(roles) ? roles : [roles];
    return user.roles.some((r) => required.includes(r));
  };

  const isProjectAuthorized = (projectId: string): boolean => {
    if (!user) return false;
    // SuperAdmin and InventoryManager have global organization visibility
    if (user.roles.includes('SuperAdmin') || user.roles.includes('InventoryManager')) {
      return true;
    }
    return user.projectScopes.includes(projectId);
  };

  const isWarehouseAuthorized = (warehouseId: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('SuperAdmin') || user.roles.includes('InventoryManager')) {
      return true;
    }
    return user.warehouseScopes.includes(warehouseId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        logout,
        clearError,
        hasRole,
        isProjectAuthorized,
        isWarehouseAuthorized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
