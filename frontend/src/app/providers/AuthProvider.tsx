import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, setAccessToken } from '@/lib/api/client';
import { CurrentUser, PermissionsContext, computePermissions } from '@/lib/permissions';

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLocked: boolean;
  unlock: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  isLocked: false,
  unlock: () => {},
});

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.get<{ status: string; data: CurrentUser }>('/auth/me');
      const userData = res.data || res;
      setUser(userData);
      return userData;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleExpired = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [fetchCurrentUser]);

  // Detector de inatividade para bloqueio de tela
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
        setIsLocked(true);
      }
    }, 60 * 1000);

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/login', { email, password });
      const token = res.access_token || res.data?.access_token;
      if (token) {
        setAccessToken(token);
      }
      if (res.user) {
        setUser(res.user);
      } else {
        await fetchCurrentUser();
      }
      setIsLocked(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignora erro no logout
    } finally {
      setUser(null);
      setAccessToken(null);
      setIsLocked(false);
    }
  };

  const unlock = () => {
    lastActivityRef.current = Date.now();
    setIsLocked(false);
  };

  const permissions = computePermissions(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        isLocked,
        unlock,
      }}
    >
      <PermissionsContext.Provider value={permissions}>
        {children}
      </PermissionsContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
