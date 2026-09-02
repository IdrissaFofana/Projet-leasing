'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { currentMois, formatMoney } from '@/lib/format';
import type { FacturePeriode } from '@/lib/types';

export default function FacturationPage() {
  const [mois, setMois] = useState(currentMois());
  const [periods, setPeriods] = useState<
    Array<FacturePeriode & { _count?: { lignes: number } }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const periodsSort = useTableSort<FacturePeriode & { _count?: { lignes: number } }>(
    'mois',
    'desc',
  );

  async function refreshList() {
    setPeriods(await api.billing.list());
  }

  useEffect(() => {
    void refreshList().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  async function calculate() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const p = await api.billing.calculate(mois);
      setOk(`Période ${p.code} calculée — ${formatMoney(p.montantTotal)}`);
      await refreshList();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Calcul impossible');
    } finally {
      setBusy(false);
    }
  }

  const sortedPeriods = useMemo(
    () =>
      periodsSort.sort(periods, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'mois') return row.mois;
        if (key === 'statut') return row.statut;
        if (key === 'montant') return Number(row.montantTotal);
        if (key === 'lignes') return row._count?.lignes ?? 0;
        return '';
      }),
    [periods, periodsSort],
  );

  return (
    <>
      <div className="page-head">
        <h1>Facturation</h1>
        <p>Calcul des périodes et consultation des factures</p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          type="month"
          value={mois}
          onChange={(e) => setMois(e.target.value)}
        />
        <button type="button" className="btn btn-esay" disabled={busy} onClick={() => void calculate()}>
          Calculer {mois}
        </button>
        <Link href={`/facturation/${mois}`} className="btn btn-soft">
          Voir détail {mois}
        </Link>
        <button
          type="button"
          className="btn btn-esay"
          disabled={busy}
          onClick={() =>
            void api.reports.leasingMensuelle(mois).catch((e) =>
              setError(e instanceof ApiError ? e.message : 'Rapport impossible'),
            )
          }
        >
          Rapport Leasing mensuel
        </button>
        <button
          type="button"
          className="btn btn-soft"
          disabled={busy}
          onClick={() =>
            void api.reports.leasingAnnuelle(mois.slice(0, 4)).catch((e) =>
              setError(e instanceof ApiError ? e.message : 'Rapport annuel impossible'),
            )
          }
        >
          Rapport Leasing annuel {mois.slice(0, 4)}
        </button>
      </div>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <div className="panel">
        <h2>Périodes facturées</h2>
        <DataTableShell className="nested" empty={sortedPeriods.length === 0}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Code" sortKey="code" activeKey={periodsSort.sortKey} direction={periodsSort.sortDir} onSort={periodsSort.toggle} />
                <SortTh label="Mois" sortKey="mois" activeKey={periodsSort.sortKey} direction={periodsSort.sortDir} onSort={periodsSort.toggle} />
                <SortTh label="Statut" sortKey="statut" activeKey={periodsSort.sortKey} direction={periodsSort.sortDir} onSort={periodsSort.toggle} />
                <SortTh label="Montant" sortKey="montant" activeKey={periodsSort.sortKey} direction={periodsSort.sortDir} onSort={periodsSort.toggle} align="right" />
                <SortTh label="Lignes" sortKey="lignes" activeKey={periodsSort.sortKey} direction={periodsSort.sortDir} onSort={periodsSort.toggle} align="right" />
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {sortedPeriods.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>{p.mois}</td>
                  <td>
                    <span className="badge badge-info">{p.statut}</span>
                  </td>
                  <td data-align="right">{formatMoney(p.montantTotal)}</td>
                  <td data-align="right">{p._count?.lignes ?? '—'}</td>
                  <td className="col-actions">
                    <Link href={`/facturation/${p.mois}`} className="btn btn-soft">
                      Détail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </div>
    </>
  );
}
