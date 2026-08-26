'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import {
  clearSession,
  getStoredUser,
  getToken,
  setSession,
  setStoredUser,
} from './auth-storage';
import type { AuthUser, ModulePermission } from './types';

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser) => void;
  hasPermission: (module: ModulePermission) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(raw: AuthUser | (UserProfileLike & { permissions?: string[] })): AuthUser {
  return {
    id: raw.id,
    email: raw.email,
    nom: raw.nom,
    role: raw.role,
    prenom: raw.prenom,
    nomFamille: raw.nomFamille,
    avatarUrl: raw.avatarUrl,
    permissions: (raw.permissions ?? []) as ModulePermission[],
    mustChangePassword: Boolean(raw.mustChangePassword),
  };
}

type UserProfileLike = {
  id: string;
  email: string;
  nom: string;
  role: AuthUser['role'];
  prenom?: string | null;
  nomFamille?: string | null;
  avatarUrl?: string | null;
  permissions?: string[];
  mustChangePassword?: boolean;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const setUser = useCallback((next: AuthUser) => {
    const normalized = normalizeUser(next);
    setStoredUser(normalized);
    setUserState(normalized);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUserState(null);
      return null;
    }
    try {
      const me = await api.me.get();
      const next = normalizeUser({
        id: me.id,
        email: me.email,
        nom: me.nom,
        role: me.role,
        prenom: me.prenom,
        nomFamille: me.nomFamille,
        avatarUrl: me.avatarUrl,
        permissions: me.effectivePermissions ?? me.permissions,
        mustChangePassword: me.mustChangePassword,
      });
      setStoredUser(next);
      setUserState(next);
      return next;
    } catch {
      return getStoredUser();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      const stored = getStoredUser();
      if (token && stored) {
        // Affiche d’abord le cache, puis resynchronise avec le serveur
        // (évite mustChangePassword obsolète → boucle change-password / dashboard)
        if (!cancelled) {
          setUserState(
            normalizeUser({
              ...stored,
              permissions: stored.permissions ?? [],
              mustChangePassword: stored.mustChangePassword ?? false,
            }),
          );
        }
        try {
          const me = await api.me.get();
          if (cancelled) return;
          const next = normalizeUser({
            id: me.id,
            email: me.email,
            nom: me.nom,
            role: me.role,
            prenom: me.prenom,
            nomFamille: me.nomFamille,
            avatarUrl: me.avatarUrl,
            permissions: me.effectivePermissions ?? me.permissions,
            mustChangePassword: me.mustChangePassword,
          });
          setStoredUser(next);
          setUserState(next);
        } catch {
          /* garde le cache local */
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    const next = normalizeUser(res.user);
    setSession(res.accessToken, next);
    setUserState(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUserState(null);
  }, []);

  const hasPermission = useCallback(
    (module: ModulePermission) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return user.permissions.includes(module);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser, setUser, hasPermission }),
    [user, ready, login, logout, refreshUser, setUser, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
