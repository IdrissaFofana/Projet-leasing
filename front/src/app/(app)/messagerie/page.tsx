'use client';

import { Suspense } from 'react';
import MessageriePage from './MessagerieClient';

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Chargement…</p>}>
      <MessageriePage />
    </Suspense>
  );
}
