'use client';

import { Suspense } from 'react';
import QuotaPrinterDetailInner from './QuotaPrinterDetailInner';

export default function QuotaPrinterDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="page-head">
          <h1>Quota</h1>
          <p>Chargement…</p>
        </div>
      }
    >
      <QuotaPrinterDetailInner />
    </Suspense>
  );
}
