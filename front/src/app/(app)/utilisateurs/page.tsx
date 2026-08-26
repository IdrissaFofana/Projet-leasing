'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UtilisateursIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/utilisateurs/comptes');
  }, [router]);
  return (
    <div className="page-head">
      <h1>Gestion utilisateurs</h1>
      <p>Redirection…</p>
    </div>
  );
}
