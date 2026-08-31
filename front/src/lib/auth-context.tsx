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
import {
  userHasCrudPermission,
  userHasPermission,
  type CrudAction,
  type ModulePermission,
} from './permissions';
import type { AuthUser } from './types';

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser) => void;
  hasPermission: (module: ModulePermission) => boolean;
  hasCrudPermission: (module: ModulePermission, action: CrudAction) => boolean;
};

function permissionsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((p, i) => p === sb[i]);
}

function sameSessionUser(prev: AuthUser | null, next: AuthUser): boolean {
  if (!prev) return false;
  return (
    prev.id === next.id &&
    prev.role === next.role &&
    prev.email === next.email &&
    prev.nom === next.nom &&
    prev.mustChangePassword === next.mustChangePassword &&
    permissionsEqual(prev.permissions, next.permissions)
  );
}

/** Intervalle de resync silencieuse des droits (ms). */
const PERMS_SYNC_MS = 60_000;

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
    permissions: raw.permissions ?? [],
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
      setUserState((prev) => {
        if (sameSessionUser(prev, next)) return prev;
        setStoredUser(next);
        return next;
      });
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

  /** Resync droits : changement d’onglet, navigation, intervalle régulier. */
  useEffect(() => {
    if (!ready || !user) return;

    const sync = () => {
      void refreshUser();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(sync, PERMS_SYNC_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [ready, user?.id, refreshUser]);

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
    (module: ModulePermission) => userHasPermission(user, module),
    [user],
  );

  const hasCrudPermission = useCallback(
    (module: ModulePermission, action: CrudAction) =>
      userHasCrudPermission(user, module, action),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      refreshUser,
      setUser,
      hasPermission,
      hasCrudPermission,
    }),
    [user, ready, login, logout, refreshUser, setUser, hasPermission, hasCrudPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}
