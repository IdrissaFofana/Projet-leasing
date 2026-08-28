'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { FactureLigne, FacturePeriode } from '@/lib/types';

export default function FactureDetailPage() {
  const { confirm } = useFeedback();
  const params = useParams<{ mois: string }>();
  const mois = params.mois;
  const [periode, setPeriode] = useState<FacturePeriode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lignesSort = useTableSort<FactureLigne>('imprimante');

  async function load() {
    setError(null);
    try {
      setPeriode(await api.billing.get(mois));
    } catch (e) {
      setPeriode(null);
      setError(e instanceof ApiError ? e.message : 'Facture introuvable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  async function calculate() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const p = await api.billing.calculate(mois);
      setPeriode(p);
      setOk(`Recalculé — ${formatMoney(p.montantTotal)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Calcul impossible');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Clôturer définitivement ${mois} ?`,
        danger: true,
        confirmLabel: 'Clôturer',
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const p = await api.billing.close(mois);
      setPeriode(p);
      setOk('Période clôturée');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Clôture impossible');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const res = await api.billing.export(mois, 'csv');
      const content = res.content ?? '';
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${mois}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setOk('Export CSV téléchargé');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }

  async function exportFile(format: 'xlsx' | 'pdf') {
    try {
      await api.billing.exportFile(mois, format);
      setOk(`Export ${format.toUpperCase()} téléchargé`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }

  const sortedLignes = useMemo(
    () =>
      periode?.lignes
        ? lignesSort.sort(periode.lignes, (row, key) => {
            if (key === 'imprimante') return row.imprimante?.code ?? '';
            if (key === 'copiesNb') return row.copiesNb;
            if (key === 'copiesCouleur') return row.copiesCouleur;
            if (key === 'montantCopies') return Number(row.montantCopies);
            if (key === 'montantScans') return Number(row.montantScans);
            if (key === 'montantTotal') return Number(row.montantTotal);
            if (key === 'statut') return row.statut;
            return '';
          })
        : [],
    [periode?.lignes, lignesSort],
  );

  if (!periode && !error) {
    return (
      <div className="page-head">
        <h1>Facture</h1>
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>{periode?.code ?? `Facture ${mois}`}</h1>
        <p>
          <Link href="/facturation">← Retour</Link>
          {periode ? (
            <>
              {' '}
              · <span className="badge badge-info">{periode.statut}</span> · Total{' '}
              <strong>{formatMoney(periode.montantTotal)}</strong>
            </>
          ) : null}
        </p>
      </div>

      <div className="toolbar">
        <button type="button" className="btn btn-esay" disabled={busy} onClick={() => void calculate()}>
          Recalculer
        </button>
        <button type="button" className="btn btn-soft" disabled={!periode} onClick={() => void exportCsv()}>
          Export CSV
        </button>
        <button type="button" className="btn btn-soft" disabled={!periode} onClick={() => void exportFile('xlsx')}>
          Export Excel
        </button>
        <button type="button" className="btn btn-esay" disabled={!periode} onClick={() => void exportFile('pdf')}>
          Export PDF
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || !periode || periode.statut === 'CLOTUREE'}
          onClick={() => void close()}
        >
          Clôturer
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

      {periode ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Synthèse</h2>
          <p>
            Prix N&B {periode.prixNb} · Couleur {periode.prixCouleur} ·{' '}
            {periode.lignes?.length ?? 0} ligne(s)
          </p>
        </div>
      ) : null}

      {periode?.lignes ? (
        <DataTableShell empty={sortedLignes.length === 0}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Copieur" sortKey="imprimante" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} />
                <th>Localisation</th>
                <SortTh label="Copies N" sortKey="copiesNb" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} align="right" />
                <SortTh label="Copies C" sortKey="copiesCouleur" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} align="right" />
                <SortTh label="Mt copies" sortKey="montantCopies" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} align="right" />
                <SortTh label="Mt scans" sortKey="montantScans" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} align="right" />
                <SortTh label="Total" sortKey="montantTotal" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} align="right" />
                <SortTh label="Statut" sortKey="statut" activeKey={lignesSort.sortKey} direction={lignesSort.sortDir} onSort={lignesSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {sortedLignes.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.imprimante?.code}</td>
                  <td>{l.imprimante?.localisation ?? '—'}</td>
                  <td data-align="right">{l.copiesNb}</td>
                  <td data-align="right">{l.copiesCouleur}</td>
                  <td data-align="right">{formatMoney(l.montantCopies)}</td>
                  <td data-align="right">{formatMoney(l.montantScans)}</td>
                  <td data-align="right">{formatMoney(l.montantTotal)}</td>
                  <td>
                    <span className="badge badge-muted">{l.statut}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      ) : null}
    </>
  );
}
