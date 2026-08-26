'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { permissionForPath, userHasPermission } from '@/lib/permissions';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const mustChange = Boolean(user?.mustChangePassword);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (mustChange) {
      router.replace('/change-password');
    }
  }, [ready, user, mustChange, router]);

  useEffect(() => {
    if (!ready || !user || mustChange) return;
    const required = permissionForPath(pathname);
    if (required && !userHasPermission(user, required)) {
      router.replace('/');
    }
  }, [ready, user, mustChange, router, pathname]);

  if (!ready) {
    return (
      <div className="gate-loading">
        <p>Chargement de la session…</p>
      </div>
    );
  }

  if (!user) return null;

  // Bloque tout le shell app tant que le MDP doit être changé
  // (évite les appels API dashboard → 403 → boucle de redirection)
  if (mustChange) {
    return (
      <div className="gate-loading">
        <p>Redirection vers le changement de mot de passe…</p>
      </div>
    );
  }

  const required = permissionForPath(pathname);
  if (required && !userHasPermission(user, required)) return null;

  return <>{children}</>;
}
