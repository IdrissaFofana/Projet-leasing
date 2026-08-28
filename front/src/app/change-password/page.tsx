'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PasswordInput } from '@/components/PasswordInput';

export default function ChangePasswordPage() {
  const { user, ready, setUser, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      if (!user) {
        router.replace('/login');
        return;
      }
      // Toujours resynchroniser avec le serveur pour éviter la boucle
      // (cache local peut avoir mustChangePassword=false à tort)
      const fresh = await refreshUser();
      if (cancelled) return;
      if (!fresh) {
        router.replace('/login');
        return;
      }
      if (!fresh.mustChangePassword) {
        router.replace('/');
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const updated = await api.changePassword({
        currentPassword: user?.mustChangePassword ? undefined : currentPassword || undefined,
        newPassword,
      });
      setUser({
        id: updated.id,
        email: updated.email,
        nom: updated.nom,
        role: updated.role,
        prenom: updated.prenom,
        nomFamille: updated.nomFamille,
        avatarUrl: updated.avatarUrl,
        permissions: updated.permissions,
        mustChangePassword: false,
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de changer le mot de passe');
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !user || checking) {
    return (
      <div className="gate-loading">
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-logo-wrap">
          <Image
            src="/logo-esay.png"
            alt="ESAY Corporation"
            width={320}
            height={100}
            className="login-logo"
            priority
            unoptimized
          />
          <p className="login-app-name">Changer le mot de passe</p>
          <p className="login-app-tag">
            Première connexion — choisissez un mot de passe personnel avant d’accéder à
            l’application
          </p>
        </div>

        <PageFeedback error={error} onDismiss={() => setError(null)} />

        <div className="field">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
            required
            minLength={6}
            aria-label="Nouveau mot de passe"
          />
        </div>

        <div className="field">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={setConfirm}
            required
            minLength={6}
            aria-label="Confirmer le mot de passe"
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>

        <button
          type="button"
          className="login-forgot"
          onClick={() => {
            logout();
            router.replace('/login');
          }}
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
