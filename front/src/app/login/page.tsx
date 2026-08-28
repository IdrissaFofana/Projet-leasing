'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PasswordInput } from '@/components/PasswordInput';

function MailIcon() {
  return (
    <svg
      className="field-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="url(#esayMail)"
        strokeWidth="1.8"
      />
      <path
        d="m5.5 8 6.5 5 6.5-5"
        stroke="url(#esayMail)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="esayMail" x1="4" y1="5" x2="20" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#008CA7" />
          <stop offset="1" stopColor="#8DC63F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    // Ne redirige que depuis /login, une fois la session connue
    if (user.mustChangePassword) {
      router.replace('/change-password');
    } else {
      router.replace('/');
    }
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const next = await login(email.trim(), password);
      router.replace(next.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
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
          <p className="login-app-name">Suivi Leasing</p>
          <p className="login-app-tag">Parc · Stock · Relevés · Facturation</p>
        </div>

        <PageFeedback error={error} onDismiss={() => setError(null)} />

        <div className="field field-iconed">
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email"
            // Extensions (ex. Temp Mail) injectent style/data-* avant l'hydratation
            suppressHydrationWarning
          />
          <MailIcon />
        </div>

        <div className="field">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={setPassword}
            required
            aria-label="Mot de passe"
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <button type="button" className="login-forgot" tabIndex={-1}>
          Mot de passe oublié ?
        </button>

        <p className="login-signup">
          Vous ne possédez pas de compte ?{' '}
          <span className="login-signup-link">S&apos;inscrire</span>
        </p>
      </form>
    </div>
  );
}
