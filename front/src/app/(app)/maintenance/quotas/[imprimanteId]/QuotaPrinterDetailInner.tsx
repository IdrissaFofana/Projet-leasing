'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { DataTableShell } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { currentMois, formatDate } from '@/lib/format';
import type { AssistanceQuota, Imprimante, Maintenance } from '@/lib/types';

export default function QuotaPrinterDetailInner() {
  const params = useParams<{ imprimanteId: string }>();
  const search = useSearchParams();
  const mois = search.get('mois') || currentMois();
  const [printer, setPrinter] = useState<Imprimante | null>(null);
  const [rows, setRows] = useState<Maintenance[]>([]);
  const [quotaLine, setQuotaLine] = useState<AssistanceQuota['lignes'][number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [p, list, quota] = await Promise.all([
          api.printers.get(params.imprimanteId),
          api.maintenance.list({
            imprimanteId: params.imprimanteId,
            type: 'ASSISTANCE',
            moisAssistance: mois,
          }),
          api.maintenance.assistanceQuota(mois),
        ]);
        setPrinter(p);
        setRows(list);
        setQuotaLine(quota.lignes.find((l) => l.imprimanteId === params.imprimanteId) ?? null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Chargement impossible');
      }
    })();
  }, [params.imprimanteId, mois]);

  const resume = useMemo(() => {
    if (quotaLine) {
      return {
        faites: quotaLine.faites,
        panne: quotaLine.panne ?? 0,
        prelevements: quotaLine.prelevements ?? 0,
        prevues: quotaLine.prevues,
        restantes: quotaLine.restantes,
        complet: quotaLine.complet,
      };
    }
    const faites = rows.filter((r) => !r.horsQuota && !r.releveId).length;
    const panne = rows.filter((r) => r.horsQuota).length;
    const prelevements = rows.filter((r) => r.releveId).length;
    const prevues = 1;
    return {
      faites,
      panne,
      prelevements,
      prevues,
      restantes: Math.max(0, prevues - faites),
      complet: faites >= prevues,
    };
  }, [quotaLine, rows]);

  return (
    <>
      <div className="page-head">
        <h1>Quota {printer?.code ?? '…'}</h1>
        <p>
          <Link href="/maintenance/quotas">← Quotas</Link> · Mois {mois}
        </p>
      </div>

      <PageFeedback error={error} onDismiss={() => setError(null)} />

      {printer ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Copieur</h2>
          <div className="form-grid">
            <div>
              Code : <strong className="mono">{printer.code}</strong>
            </div>
            <div>
              Localisation / position : <strong>{printer.localisation ?? '—'}</strong>
            </div>
            <div>
              Modèle : <strong>{printer.modele ?? '—'}</strong>
            </div>
            <div>
              Assistances incluses : <strong>{resume.faites}/{resume.prevues}</strong>{' '}
              <span className={resume.complet ? 'badge badge-ok' : 'badge badge-warn'}>
                {resume.complet ? 'Complet' : `${resume.restantes} restante(s)`}
              </span>
            </div>
            <div>
              Pannes (hors quota) : <strong>{resume.panne}</strong>
            </div>
            <div>
              Prélèvements compteur (hors quota) : <strong>{resume.prelevements}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <DataTableShell empty={rows.length === 0} emptyMessage="Aucune assistance ce mois">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Date</th>
              <th>Statut quota</th>
              <th>Actions</th>
              <th>Rapport</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{formatDate(r.dateMaintenance)}</td>
                <td>
                  {r.horsQuota ? (
                    <span className="badge badge-warn">Panne (hors quota)</span>
                  ) : r.releveId ? (
                    <span className="badge badge-info">Prélèvement compteur (hors quota)</span>
                  ) : (
                    <span className="badge badge-ok">Incluse</span>
                  )}
                </td>
                <td>{r.actionsRealisees ?? '—'}</td>
                <td>{r.rapportNom ?? '—'}</td>
                <td className="col-actions">
                  <Link href={`/maintenance/${r.id}`} className="btn btn-soft">
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
