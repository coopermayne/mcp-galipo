import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Dev mode: skip auth entirely (set VITE_DEV_SKIP_AUTH=true in .env)
const DEV_SKIP_AUTH = import.meta.env.VITE_DEV_SKIP_AUTH === 'true';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  barNumber?: string | null;
  position: string;
  isAdmin: boolean;
  paralegalId?: number | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; mustChangePassword?: boolean }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Verify stored token on mount (or auto-auth in dev mode)
  useEffect(() => {
    const verifyToken = async () => {
      // Dev mode: fetch user from backend (which skips auth and returns DEV_AUTH_USER)
      if (DEV_SKIP_AUTH) {
        try {
          const response = await fetch('/api/v1/auth/verify');
          if (response.ok) {
            const data = await response.json();
            setIsAuthenticated(true);
            setUser(data.user);
          }
        } catch {
          // Fallback if backend not ready
          setIsAuthenticated(true);
          setUser({ id: 0, email: 'dev@localhost', firstName: 'Dev', lastName: 'User', initials: 'DU', position: 'admin', isAdmin: true });
        }
        setIsLoading(false);
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/v1/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          if (data.user) {
            setUser(data.user);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } else {
            // Fallback to stored user
            const storedUser = localStorage.getItem(USER_KEY);
            if (storedUser) {
              setUser(JSON.parse(storedUser));
            }
          }
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; mustChangePassword?: boolean }> => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        if (data.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
        setIsAuthenticated(true);

        if (data.mustChangePassword) {
          setMustChangePassword(true);
          return { success: true, mustChangePassword: true };
        }

        return { success: true, mustChangePassword: false };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    try {
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update token if a new one was provided
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
        if (data.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
        setMustChangePassword(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore errors on logout
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setMustChangePassword(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      mustChangePassword,
      login,
      logout,
      changePassword,
      clearMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
