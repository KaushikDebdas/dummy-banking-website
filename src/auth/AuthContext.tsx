import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { SESSION_KEY } from '../store/storage';
import * as svc from '../store/services';
import type { Result, User } from '../types';
import { can, type Permission } from './permissions';
import { clearActivity, touchActivity, wasExpired } from './session';

interface AuthApi {
  user: User | null;
  login: (username: string, password: string) => Result<User>;
  logout: () => void;
  can: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthApi | null>(null);

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, run } = useStore();
  const [username, setUsername] = useState<string | null>(readSession);
  const found = username ? state.users.find((u) => u.username === username) ?? null : null;
  // A user that gets locked (e.g. by an admin) loses their session.
  const user = found && found.status === 'Active' ? found : null;

  const login = useCallback(
    (u: string, p: string) => {
      const res = run((draft) => svc.login(draft, u, p));
      if (res.ok) {
        localStorage.setItem(SESSION_KEY, res.data.username);
        touchActivity();
        setUsername(res.data.username);
      }
      return res;
    },
    [run],
  );

  const logout = useCallback(() => {
    if (user) run((draft) => svc.logout(draft, user));
    localStorage.removeItem(SESSION_KEY);
    clearActivity();
    setUsername(null);
  }, [run, user]);

  return <AuthContext.Provider value={{ user, login, logout, can: (perm) => can(user, perm) }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Hook for pages rendered behind RequireAuth, where a user is guaranteed. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No authenticated user');
  return user;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to={`/login?${wasExpired() ? 'expired=1&' : ''}next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}
