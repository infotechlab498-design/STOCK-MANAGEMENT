import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService, UserProfile } from '../services/api/authService';
import {
  setAuthTokenProvider,
  setUnauthorizedHandler,
  isJwtTokenValid,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  ApiClientException,
} from '../services/api/apiClient';

const DEMO_ROLE_PASSWORDS: Record<string, string> = {
  'admin@constructcorp.com': 'Admin@2026!Stock',
  'inv.manager@constructcorp.com': 'Manager@2026!Inv',
  'pm.metro@constructcorp.com': 'Project@2026!Metro',
  'store.north@constructcorp.com': 'Store@2026!Keeper',
  'procurement@constructcorp.com': 'Procure@2026!Officer',
  'accounts@constructcorp.com': 'Accounts@2026!Valuation',
  'auditor@constructcorp.com': 'Viewer@2026!Audit',
};

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readInitialSession(): { token: string | null; user: UserProfile | null } {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }
  try {
    const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const savedUserRaw = sessionStorage.getItem(USER_STORAGE_KEY);

    if (!isJwtTokenValid(savedToken) || !savedUserRaw) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      return { token: null, user: null };
    }

    const parsedUser = JSON.parse(savedUserRaw) as UserProfile;
    if (!parsedUser || typeof parsedUser.id !== 'string' || !Array.isArray(parsedUser.roles)) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      return { token: null, user: null };
    }

    return { token: savedToken!.trim(), user: parsedUser };
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    return { token: null, user: null };
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initialSession = readInitialSession();
  const [user, setUser] = useState<UserProfile | null>(initialSession.user);
  const [token, setToken] = useState<string | null>(initialSession.token);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronously register active token provider
  setAuthTokenProvider(() => (isJwtTokenValid(token) ? token : null));

  const clearSessionState = useCallback((message?: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }
    setToken(null);
    setUser(null);
    if (message) {
      setError(message);
    }
  }, []);

  useEffect(() => {
    setAuthTokenProvider(() => (isJwtTokenValid(token) ? token : null));
    setUnauthorizedHandler((reason) => {
      clearSessionState(reason || 'Your session has expired. Please sign in again.');
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [token, clearSessionState]);

  // Verify existing session token against /api/v1/auth/me on mount
  useEffect(() => {
    if (!token || !isJwtTokenValid(token)) {
      if (token) {
        clearSessionState('Your session has expired. Please sign in again.');
      }
      return;
    }

    let isMounted = true;
    const verifyActiveSession = async () => {
      try {
        const res = await authService.getMe();
        if (isMounted && res.success && res.data) {
          setUser(res.data);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data));
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiClientException && (err.status === 401 || err.status === 403)) {
          clearSessionState(err.message || 'Your session is no longer valid. Please sign in again.');
        }
      }
    };

    verifyActiveSession();
    return () => {
      isMounted = false;
    };
  }, [token, clearSessionState]);

  const login = async (usernameOrEmail: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.login(usernameOrEmail.trim(), password);
      if (res.success && res.data && isJwtTokenValid(res.data.accessToken)) {
        const { accessToken, user: userProfile } = res.data;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
          sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userProfile));
        }
        setAuthTokenProvider(() => accessToken);
        setToken(accessToken);
        setUser(userProfile);
        return;
      }
      throw new Error(res.message || 'Authentication failed');
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientException
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Invalid credentials or unable to reach authentication server.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchRoleProfile = async (emailKey: string): Promise<void> => {
    const normalized = emailKey.trim().toLowerCase();
    const demoPassword = DEMO_ROLE_PASSWORDS[normalized];
    if (!demoPassword) {
      await logout();
      return;
    }
    await login(normalized, demoPassword);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (token && isJwtTokenValid(token)) {
        await authService.logout();
      }
    } catch {
      // Ignore logout network/401 error when clearing local session
    } finally {
      clearSessionState();
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  const hasRole = (roles: string | string[]): boolean => {
    if (!user || !token || !isJwtTokenValid(token)) return false;
    const required = Array.isArray(roles) ? roles : [roles];
    return user.roles.some((r) => required.includes(r));
  };

  const isProjectAuthorized = (projectId: string): boolean => {
    if (!user || !token || !isJwtTokenValid(token)) return false;
    if (user.roles.includes('SuperAdmin') || user.roles.includes('InventoryManager')) {
      return true;
    }
    return user.projectScopes.includes(projectId);
  };

  const isWarehouseAuthorized = (warehouseId: string): boolean => {
    if (!user || !token || !isJwtTokenValid(token)) return false;
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
        switchRoleProfile,
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
