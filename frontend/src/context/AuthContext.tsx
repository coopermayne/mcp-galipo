import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

const TOKEN_KEY = 'auth_token';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    const verifyToken = async () => {
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
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
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
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
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
}
