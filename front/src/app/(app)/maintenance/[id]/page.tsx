'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileDropzone } from '@/components/FileDropzone';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Maintenance } from '@/lib/types';

export default function MaintenanceDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Maintenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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
        <p className="form-error">{error}</p>
      </div>
    );
  }

  const p = row.imprimante;

  return (
    <>
      <div className="page-head">
        <h1>{row.code}</h1>
        <p>
          <Link href="/maintenance">← Interventions</Link> ·{' '}
          <span className="badge badge-info">{row.type}</span> · {formatDate(row.dateMaintenance)}
        </p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="msg-ok">{ok}</p> : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Imprimante</h2>
        <div className="form-grid">
          <div>
            Code : <strong className="mono">{p?.code ?? '—'}</strong>
          </div>
          <div>
            Localisation / position : <strong>{p?.localisation ?? '—'}</strong>
          </div>
          <div>
            Modèle : <strong>{p?.modele ?? '—'}</strong>
          </div>
          <div>
            N° série : <strong>{p?.numeroSerie ?? '—'}</strong>
          </div>
          <div>
            Marque : <strong>{p?.marque?.nom ?? '—'}</strong>
          </div>
          <div>
            Service : <strong>{p?.service?.nom ?? '—'}</strong>
          </div>
          <div>
            Statut machine : <strong>{p?.statut ?? '—'}</strong>
          </div>
        </div>
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
        <h2>Rapport d’assistance</h2>
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
