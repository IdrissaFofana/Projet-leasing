'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ImprimanteDetailRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/imprimantes?id=${params.id}`);
  }, [params.id, router]);

  return (
    <div className="page-head">
      <h1>Copieur</h1>
      <p>Ouverture de la fiche…</p>
    </div>
  );
}
