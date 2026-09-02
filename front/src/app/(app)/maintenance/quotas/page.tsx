'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { currentMois } from '@/lib/format';
import type { AssistanceQuota } from '@/lib/types';

type QuotaLigne = AssistanceQuota['lignes'][number];

export default function MaintenanceQuotasPage() {
  const [mois, setMois] = useState(currentMois());
  const [quota, setQuota] = useState<AssistanceQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { sortKey, sortDir, toggle, sort } = useTableSort<QuotaLigne>('code');

  useEffect(() => {
    void api.maintenance
      .assistanceQuota(mois)
      .then(setQuota)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'));
  }, [mois]);

  const sorted = useMemo(
    () =>
      quota
        ? sort(quota.lignes, (row, key) => {
            if (key === 'code') return row.code;
            if (key === 'localisation') return row.localisation ?? '';
            if (key === 'faites') return row.faites;
            if (key === 'restantes') return row.restantes;
            return '';
          })
        : [],
    [quota, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Quotas assistances</h1>
          <p>1 assistance incluse par copieur et par mois (prélèvements compteur et pannes hors quota)</p>
        </div>
        <input className="input" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
      </div>

      <PageFeedback error={error} onDismiss={() => setError(null)} />

      {quota ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <p>
            {quota.incomplete === 0
              ? `Tous les copieurs ont atteint ${quota.prevuesParImprimante} assistances pour ${quota.mois}.`
              : `${quota.incomplete} copieur(s) sous le quota ${quota.prevuesParImprimante}/mois.`}
          </p>
        </div>
      ) : null}

      <DataTableShell empty={!quota || sorted.length === 0}>
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Copieur" sortKey="code" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Faites" sortKey="faites" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Restantes" sortKey="restantes" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <th>Panne</th>
              <th>Statut</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.imprimanteId}>
                <td className="mono">{l.code}</td>
                <td>{l.localisation ?? '—'}</td>
                <td data-align="right">
                  {l.faites}/{l.prevues}
                </td>
                <td data-align="right">{l.restantes}</td>
                <td data-align="right">{l.panne ?? 0}</td>
                <td>
                  <span className={l.complet ? 'badge badge-ok' : 'badge badge-warn'}>
                    {l.complet ? 'Complet' : 'À planifier'}
                  </span>
                </td>
                <td className="col-actions">
                  <Link
                    href={`/maintenance/quotas/${l.imprimanteId}?mois=${mois}`}
                    className="btn btn-soft"
                  >
                    Détail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
