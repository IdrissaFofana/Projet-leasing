'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { FileDropzone } from '@/components/FileDropzone';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Maintenance } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  ASSISTANCE: 'Assistance',
  PREVENTIVE: 'Préventive',
  CORRECTIVE: 'Corrective',
  DEPANNAGE: 'Dépannage',
  NETTOYAGE: 'Nettoyage',
  REMPLACEMENT_PIECE: 'Remplacement pièce',
  CONTROLE_PERIODIQUE: 'Contrôle périodique',
};

export default function MaintenanceDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Maintenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    try {
      setRow(await api.maintenance.get(params.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Intervention introuvable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function exportPdf() {
    if (!row) return;
    setExporting(true);
    setError(null);
    try {
      await api.reports.intervention(row.id, row.code);
      setOk('Rapport PDF téléchargé');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  }

  if (!row && !error) {
    return (
      <div className="page-head">
        <h1>Intervention</h1>
        <p>Chargement…</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="page-head">
        <h1>Intervention</h1>
        <PageFeedback error={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  const taches = row.taches?.length ? row.taches : [row.type];

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>{row.code}</h1>
          <p>
            <Link href="/maintenance">← Interventions</Link> ·{' '}
            {taches.map((t) => (
              <span key={t} className="badge badge-info" style={{ marginRight: 6 }}>
                {TYPE_LABEL[t] ?? t}
              </span>
            ))}{' '}
            · {formatDate(row.dateMaintenance)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-esay"
          disabled={exporting}
          onClick={() => void exportPdf()}
        >
          {exporting ? 'Export…' : 'Rapport PDF'}
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

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Copieur(s) concerné(s)</h2>
        <div className="form-grid">
          {(row.imprimantes?.length
            ? row.imprimantes
            : row.imprimante
              ? [{ imprimante: row.imprimante }]
              : []
          ).map((l) => (
            <div key={l.imprimante?.id ?? l.imprimante?.code}>
              <strong className="mono">{l.imprimante?.code ?? '—'}</strong>
              {' — '}
              {l.imprimante?.localisation ?? '—'}
            </div>
          ))}
        </div>
        {taches.includes('ASSISTANCE') ? (
          <p style={{ marginTop: 12 }}>
            Quota :{' '}
            {row.horsQuota ? (
              <span className="badge badge-warn">Panne signalée (hors quota)</span>
            ) : row.releveId ? (
              <span className="badge badge-info">Prélèvement compteur (hors quota)</span>
            ) : (
              <span className="badge badge-ok">Assistance incluse</span>
            )}
          </p>
        ) : null}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Tâches réalisées</h2>
        <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {taches.map((t) => (
            <li key={t}>{TYPE_LABEL[t] ?? t}</li>
          ))}
        </ol>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Intervention</h2>
        <div className="form-grid">
          <div>
            Technicien : <strong>{row.technicien?.nom ?? '—'}</strong>
          </div>
          <div>
            Assigné à :{' '}
            <strong>
              {row.assigneeUser
                ? `${row.assigneeUser.nom} (${row.assigneeUser.email})`
                : '—'}
            </strong>
          </div>
          <div>
            Mois assistance : <strong>{row.moisAssistance ?? '—'}</strong>
          </div>
          <div>
            Prochaine :{' '}
            <strong>
              {row.prochaineMaintenance ? formatDate(row.prochaineMaintenance) : '—'}
            </strong>
          </div>
          <div>
            Relevé lié :{' '}
            {row.releve ? (
              <Link href={`/releves/${row.releve.id}`}>{row.releve.code}</Link>
            ) : (
              '—'
            )}
          </div>
        </div>
        <p style={{ marginTop: '0.85rem' }}>
          <strong>Actions :</strong> {row.actionsRealisees ?? '—'}
        </p>
        <p>
          <strong>Observations :</strong> {row.observations ?? '—'}
        </p>
      </div>

      <div className="panel">
        <h2>Rapport d’assistance (pièce jointe)</h2>
        {row.rapportNom ? (
          <p>
            Fichier : <strong>{row.rapportNom}</strong>{' '}
            <button
              type="button"
              className="btn btn-soft"
              onClick={() =>
                void api.maintenance.downloadRapport(row.id, row.rapportNom ?? 'rapport')
              }
            >
              Télécharger
            </button>
          </p>
        ) : (
          <p className="empty-state">Aucun rapport</p>
        )}
        <FileDropzone
          existingName={row.rapportNom}
          onFile={(f) => {
            if (!f) return;
            void api.maintenance
              .uploadRapport(row.id, f)
              .then(() => {
                setOk('Rapport enregistré');
                return load();
              })
              .catch((e) =>
                setError(e instanceof ApiError ? e.message : 'Upload impossible'),
              );
          }}
        />
      </div>
    </>
  );
}
