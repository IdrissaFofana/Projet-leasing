'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { DataTableShell } from '@/components/DataTable';
import { api, ApiError } from '@/lib/api';
import { currentMois, formatDate } from '@/lib/format';
import type { Imprimante, Maintenance } from '@/lib/types';

export default function QuotaPrinterDetailInner() {
  const params = useParams<{ imprimanteId: string }>();
  const search = useSearchParams();
  const mois = search.get('mois') || currentMois();
  const [printer, setPrinter] = useState<Imprimante | null>(null);
  const [rows, setRows] = useState<Maintenance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [p, list] = await Promise.all([
          api.printers.get(params.imprimanteId),
          api.maintenance.list({
            imprimanteId: params.imprimanteId,
            type: 'ASSISTANCE',
            moisAssistance: mois,
          }),
        ]);
        setPrinter(p);
        setRows(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Chargement impossible');
      }
    })();
  }, [params.imprimanteId, mois]);

  const resume = useMemo(() => {
    const faites = rows.length;
    return { faites, restantes: Math.max(0, 3 - faites), complet: faites >= 3 };
  }, [rows]);

  return (
    <>
      <div className="page-head">
        <h1>Quota {printer?.code ?? '…'}</h1>
        <p>
          <Link href="/maintenance/quotas">← Quotas</Link> · Mois {mois}
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {printer ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Imprimante</h2>
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
              N° série : <strong>{printer.numeroSerie ?? '—'}</strong>
            </div>
            <div>
              Marque : <strong>{printer.marque?.nom ?? '—'}</strong>
            </div>
            <div>
              Service : <strong>{printer.service?.nom ?? '—'}</strong>
            </div>
            <div>
              Assistances : <strong>{resume.faites}/3</strong>{' '}
              <span className={resume.complet ? 'badge badge-ok' : 'badge badge-warn'}>
                {resume.complet ? 'Complet' : `${resume.restantes} restante(s)`}
              </span>
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
