'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleLabel, useLocale } from '@/lib/locale-context';
import type { AuthUser, UserProfile } from '@/lib/types';
import { PasswordInput } from '@/components/PasswordInput';

type Tab = 'infos' | 'compte';

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: full, nomFamille: '' };
  return { prenom: parts.slice(0, -1).join(' '), nomFamille: parts[parts.length - 1] };
}

function toDateInput(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function ProfilPage() {
  const { user, setUser } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('infos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [prenom, setPrenom] = useState('');
  const [nomFamille, setNomFamille] = useState('');
  const [email, setEmail] = useState('');
  const [autreAdresse, setAutreAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [autreTelephone, setAutreTelephone] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [languePref, setLanguePref] = useState<'fr' | 'en'>('fr');
  const [notifEmail, setNotifEmail] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  function hydrate(me: UserProfile) {
    const split = splitName(me.nom);
    setPrenom(me.prenom ?? split.prenom);
    setNomFamille(me.nomFamille ?? split.nomFamille);
    setEmail(me.email);
    setAutreAdresse(me.autreAdresse ?? '');
    setTelephone(me.telephone ?? '');
    setAutreTelephone(me.autreTelephone ?? '');
    setDateNaissance(toDateInput(me.dateNaissance));
    setAvatarUrl(me.avatarUrl);
    setRole(me.role);
    setLanguePref((me.languePref as 'fr' | 'en') || 'fr');
    setNotifEmail(me.notifEmail ?? true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const me = await api.me.get();
        if (!cancelled) hydrate(me);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Chargement impossible');
          if (user) {
            const split = splitName(user.nom);
            setPrenom(user.prenom ?? split.prenom);
            setNomFamille(user.nomFamille ?? split.nomFamille);
            setEmail(user.email);
            setRole(user.role);
            setAvatarUrl(user.avatarUrl ?? null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayName = useMemo(
    () => [prenom, nomFamille].filter(Boolean).join(' ') || user?.nom || 'Utilisateur',
    [prenom, nomFamille, user?.nom],
  );

  async function applyUser(updated: UserProfile) {
    setUser({
      id: updated.id,
      email: updated.email,
      nom: updated.nom,
      role: updated.role,
      prenom: updated.prenom,
      nomFamille: updated.nomFamille,
      avatarUrl: updated.avatarUrl,
      permissions: (updated.effectivePermissions ??
        updated.permissions ??
        user?.permissions ??
        []) as AuthUser['permissions'],
      mustChangePassword: updated.mustChangePassword ?? false,
    });
    hydrate(updated);
    if (updated.languePref === 'fr' || updated.languePref === 'en') {
      setLocale(updated.languePref);
    }
  }

  async function saveInfos(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const updated = await api.me.update({
        prenom: prenom.trim(),
        nomFamille: nomFamille.trim(),
        email: email.trim(),
        autreAdresse: autreAdresse.trim(),
        telephone: telephone.trim(),
        autreTelephone: autreTelephone.trim(),
        dateNaissance: dateNaissance || null,
        avatarUrl,
      });
      await applyUser(updated);
      setOk('Informations générales enregistrées');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function saveCompte(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);

    if (password) {
      if (!currentPassword) {
        setError('Saisissez votre mot de passe actuel');
        setSaving(false);
        return;
      }
      if (password.length < 6) {
        setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
        setSaving(false);
        return;
      }
      if (password !== password2) {
        setError('Les mots de passe ne correspondent pas');
        setSaving(false);
        return;
      }
    }

    try {
      const updated = await api.me.update({
        languePref,
        notifEmail,
        ...(password
          ? { currentPassword, password }
          : {}),
      });
      await applyUser(updated);
      setCurrentPassword('');
      setPassword('');
      setPassword2('');
      setOk('Paramètres du compte enregistrés');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  function onPickAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez une image (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 1_500_000) {
      setError('Image trop lourde (max 1,5 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      setAvatarUrl(data);
      setOk('Photo prête — cliquez sur Enregistrer pour confirmer');
    };
    reader.readAsDataURL(file);
  }

  if (loading) {
    return <p className="muted">Chargement du profil…</p>;
  }

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-hero-main">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-tools">
              <button
                type="button"
                className="profile-avatar-btn"
                title="Changer la photo"
                onClick={() => fileRef.current?.click()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8h4.6L15.5 6H18A2.5 2.5 0 0 1 20.5 8.5v8A2.5 2.5 0 0 1 18 19H6.5A2.5 2.5 0 0 1 4 16.5v-8Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                type="button"
                className="profile-avatar-btn"
                title="Importer une photo"
                onClick={() => fileRef.current?.click()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 16V5M8 8.5 12 4.5 16 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="profile-avatar">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M5 19c1.5-3.5 3.8-5.2 7-5.2s5.5 1.7 7 5.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            <h1 className="profile-hero-name">{displayName}</h1>
          </div>

          <div className="profile-hero-meta">
            <span className="profile-role-badge">{roleLabel(role, locale)}</span>
            <p className="profile-hero-email">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3.5" y="6" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              {email}
            </p>
            <Link href="/messagerie" className="profile-remind-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Rappels
            </Link>
          </div>
        </div>

        <div className="profile-hero-stat">
          <strong>0</strong>
          <span>NOMBRE TOTAL D&apos;HEURES SUR LE PROJET</span>
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Sections profil">
        <button
          type="button"
          className={`profile-tab${tab === 'infos' ? ' is-active' : ''}`}
          onClick={() => {
            setTab('infos');
            setOk(null);
            setError(null);
          }}
        >
          Informations générales
        </button>
        <button
          type="button"
          className={`profile-tab${tab === 'compte' ? ' is-active' : ''}`}
          onClick={() => {
            setTab('compte');
            setOk(null);
            setError(null);
          }}
        >
          Paramètres du compte
        </button>
      </nav>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      {tab === 'infos' && (
        <form className="profile-panel" onSubmit={saveInfos}>
          <div className="profile-panel-title">Informations générales</div>

          <div className="profile-row">
            <label htmlFor="prenom">Prénom</label>
            <input
              id="prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Prénom"
              required
            />
          </div>
          <div className="profile-row">
            <label htmlFor="nomFamille">Nom</label>
            <input
              id="nomFamille"
              value={nomFamille}
              onChange={(e) => setNomFamille(e.target.value)}
              placeholder="Nom"
              required
            />
          </div>
          <div className="profile-row">
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Adresse e-mail"
              required
            />
          </div>
          <div className="profile-row is-top">
            <label htmlFor="autreAdresse">Autre adresse</label>
            <textarea
              id="autreAdresse"
              value={autreAdresse}
              onChange={(e) => setAutreAdresse(e.target.value)}
              placeholder="Autre adresse"
              rows={3}
            />
          </div>
          <div className="profile-row">
            <label htmlFor="telephone">Téléphone</label>
            <div className="profile-phone">
              <span className="profile-flag" title="Côte d'Ivoire">
                CI
              </span>
              <span className="profile-cc">+225</span>
              <input
                id="telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="01 23 45 6789"
              />
            </div>
          </div>
          <div className="profile-row">
            <label htmlFor="autreTelephone">Autre téléphone</label>
            <div className="profile-phone">
              <span className="profile-flag" title="Côte d'Ivoire">
                CI
              </span>
              <span className="profile-cc">+225</span>
              <input
                id="autreTelephone"
                value={autreTelephone}
                onChange={(e) => setAutreTelephone(e.target.value)}
                placeholder="01 23 45 6789"
              />
            </div>
          </div>
          <div className="profile-row">
            <label htmlFor="dateNaissance">Date de naissance</label>
            <input
              id="dateNaissance"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
            />
          </div>

          <div className="profile-actions">
            {avatarUrl && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAvatarUrl(null)}
              >
                Retirer la photo
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {tab === 'compte' && (
        <form className="profile-panel" onSubmit={saveCompte}>
          <div className="profile-panel-title">Paramètres du compte</div>

          <div className="profile-row">
            <label>Rôle</label>
            <input value={roleLabel(role, locale)} disabled readOnly />
          </div>

          <div className="profile-row">
            <label htmlFor="languePref">Langue de l&apos;interface</label>
            <select
              id="languePref"
              value={languePref}
              onChange={(e) => setLanguePref(e.target.value as 'fr' | 'en')}
            >
              <option value="fr">{t('french')}</option>
              <option value="en">{t('english')}</option>
            </select>
          </div>

          <div className="profile-row">
            <label htmlFor="notifEmail">Notifications e-mail</label>
            <label className="profile-switch">
              <input
                id="notifEmail"
                type="checkbox"
                checked={notifEmail}
                onChange={(e) => setNotifEmail(e.target.checked)}
              />
              <span>{notifEmail ? 'Activées' : 'Désactivées'}</span>
            </label>
          </div>

          <div className="profile-panel-subtitle">Sécurité — changer le mot de passe</div>

          <div className="profile-row">
            <label htmlFor="currentPassword">Mot de passe actuel</label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              placeholder="Requis uniquement pour changer le mdp"
            />
          </div>
          <div className="profile-row">
            <label htmlFor="password">Nouveau mot de passe</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Laisser vide pour ne pas changer"
            />
          </div>
          <div className="profile-row">
            <label htmlFor="password2">Confirmer</label>
            <PasswordInput
              id="password2"
              value={password2}
              onChange={setPassword2}
              autoComplete="new-password"
              placeholder="Confirmer le nouveau mot de passe"
            />
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
