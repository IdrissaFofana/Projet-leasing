'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { FileDropzone } from '@/components/FileDropzone';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatDateTime } from '@/lib/format';
import type { ObservationReleve, Releve } from '@/lib/types';
import { OBSERVATION_RELEVE_LABEL } from '@/lib/types';

const RELEVES_QUERY_KEY = 'releves:lastQuery';

function statutBadge(statut: string) {
  if (statut === 'OK' || statut === 'VALIDE') return 'badge badge-ok';
  if (statut === 'BASE_INITIALE' || statut === 'CONTROLE') return 'badge badge-info';
  if (statut === 'ANOMALIE_COMPTEUR') return 'badge badge-danger';
  if (statut === 'A_CONTROLER' || statut === 'BROUILLON') return 'badge badge-warn';
  return 'badge badge-muted';
}

export default function ReleveDetailPage() {
  const { confirm } = useFeedback();
  const router = useRouter();
  const { hasCrudPermission } = useAuth();
  const canDelete = hasCrudPermission('readings', 'delete');
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Releve | null>(null);
  const [backHref, setBackHref] = useState('/releves');

  useEffect(() => {
    try {
      setBackHref(sessionStorage.getItem(RELEVES_QUERY_KEY) || '/releves');
    } catch {
      setBackHref('/releves');
    }
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    c112: '',
    c113: '',
    c122: '',
    c123: '',
    c501: '',
    scanNoir: '',
    scanCouleur: '',
    envoi: '',
    observationMotif: '' as '' | ObservationReleve,
    observations: '',
  });

  async function load() {
    try {
      setRow(await api.readings.get(params.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Introuvable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function openEdit() {
    if (!row) return;
    setForm({
      c112: String(row.c112),
      c113: String(row.c113),
      c122: String(row.c122),
      c123: String(row.c123),
      c501: row.c501 == null ? '' : String(row.c501),
      scanNoir: String(row.scanNoir),
      scanCouleur: String(row.scanCouleur),
      envoi: String(row.envoi),
      observationMotif: row.observationMotif ?? '',
      observations: row.observations ?? '',
    });
    setFormError(null);
    setEditOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.readings.update(row.id, {
        c112: Number(form.c112 || 0),
        c113: Number(form.c113 || 0),
        c122: Number(form.c122 || 0),
        c123: Number(form.c123 || 0),
        c501: form.c501 === '' ? null : Number(form.c501),
        scanNoir: Number(form.scanNoir || 0),
        scanCouleur: Number(form.scanCouleur || 0),
        envoi: Number(form.envoi || 0),
        observationMotif: form.observationMotif || null,
        observations: form.observations || null,
      });
      setRow(updated);
      setEditOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeReleve() {
    if (!row) return;
    if (
      !(await confirm({
        title: 'Supprimer le relevé',
        message: `Supprimer définitivement ${row.code} (${row.imprimante?.code} · ${row.moisFacture}) ? L’assistance liée sera conservée mais détachée. Si une facture a été calculée pour ce mois, recalculez-la ensuite.`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.readings.delete(row.id);
      const hints: string[] = [];
      if (res.campagneRouverte) hints.push('campagne rouverte');
      if (res.factureRecalculRequise) hints.push('recalcul facturation requis');
      router.push(hints.length ? `/releves?deleted=${row.code}&hint=${hints.join(',')}` : `/releves?deleted=${row.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    } finally {
      setSaving(false);
    }
  }

  if (!row && !error) {
    return (
      <div className="page-head">
        <h1>Relevé</h1>
        <p>Chargement…</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="page-head">
        <h1>Relevé</h1>
        <PageFeedback error={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  const locked = row.statut === 'VALIDE';

  return (
    <>
      <PageFeedback error={error} onDismiss={() => setError(null)} />
      <div className="page-head page-head-row">
        <div>
          <h1>{row.code}</h1>
          <p>
            <Link href={backHref}>← Retour</Link> · {row.imprimante?.code} · {row.moisFacture} ·{' '}
            {formatDate(row.dateReleve)} ·{' '}
            <span className={statutBadge(row.statut)}>{row.statut}</span>
          </p>
        </div>
        <div className="actions-inline">
          {!locked ? (
            <button type="button" className="btn btn-soft" onClick={openEdit}>
              Modifier
            </button>
          ) : null}
          {row.statut === 'ANOMALIE_COMPTEUR' ? (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => {
                setForm((f) => ({ ...f, observationMotif: 'RESET_COMPTEUR' }));
                openEdit();
              }}
            >
              Justifier anomalie
            </button>
          ) : null}
          {row.statut === 'OK' || row.statut === 'A_CONTROLER' || row.statut === 'BASE_INITIALE' ? (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => void api.readings.markControle(row.id).then(load)}
            >
              Marquer contrôlé
            </button>
          ) : null}
          {row.statut === 'CONTROLE' || row.statut === 'OK' || row.statut === 'BASE_INITIALE' ? (
            <button
              type="button"
              className="btn btn-esay"
              onClick={() => void api.readings.markValide(row.id).then(load)}
            >
              Valider facturation
            </button>
          ) : null}
          {canDelete && !locked ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving}
              onClick={() => void removeReleve()}
            >
              Supprimer
            </button>
          ) : null}
        </div>
      </div>

      {row.statut === 'ANOMALIE_COMPTEUR' ? (
        <div className="panel" style={{ marginTop: '1rem', borderColor: '#fecaca' }}>
          <h2>Cause de l&apos;anomalie compteur</h2>
          {row.anomalyReasons && row.anomalyReasons.length > 0 ? (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {row.anomalyReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              Compteurs inférieurs au relevé précédent — justifiez via « Justifier anomalie »
              (reset, remplacement…).
            </p>
          )}
        </div>
      ) : null}

      <div className="panel">
        <h2>Compteurs</h2>
        <div className="form-grid">
          <div>112: <strong>{row.c112}</strong> {row.ancienTotalNoir != null ? <span className="badge badge-muted">anc. N {row.ancienTotalNoir}</span> : null}</div>
          <div>113: <strong>{row.c113}</strong></div>
          <div>122: <strong>{row.c122}</strong></div>
          <div>123: <strong>{row.c123}</strong></div>
          <div>501 (scan): <strong>{row.c501 ?? '—'}</strong></div>
          <div>Scan N: <strong>{row.scanNoir}</strong></div>
          <div>Scan C: <strong>{row.scanCouleur}</strong></div>
          <div>Envoi: <strong>{row.envoi}</strong></div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>Rapport compteur</h2>
        {row.rapportNom ? (
          <p>
            Fichier : <strong>{row.rapportNom}</strong>{' '}
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => void api.readings.downloadRapport(row.id, row.rapportNom ?? 'rapport')}
            >
              Télécharger
            </button>
          </p>
        ) : (
          <p className="empty-state">Aucun rapport attaché</p>
        )}
        <FileDropzone
          existingName={row.rapportNom}
          onFile={(f) => {
            if (!f) return;
            void api.readings
              .uploadRapport(row.id, f)
              .then(load)
              .catch((err) =>
                setError(err instanceof ApiError ? err.message : 'Upload impossible'),
              );
          }}
        />
        {row.assistance ? (
          <p style={{ marginTop: '0.75rem' }}>
            Assistance liée : <Link href={`/maintenance/${row.assistance.id}`}>{row.assistance.code}</Link>
          </p>
        ) : null}
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2>Différences & quotas</h2>
        <div className="form-grid">
          <div>Total noir: <strong>{row.totalNoir}</strong></div>
          <div>Total couleur: <strong>{row.totalCouleur}</strong></div>
          <div>Δ noir (conso): <strong>{row.copiesNoirDelta ?? '—'}</strong></div>
          <div>Δ couleur (conso): <strong>{row.copiesCouleurDelta ?? '—'}</strong></div>
          <div>Quota N dispo: <strong>{row.quotaNoirDispo ?? '—'}</strong></div>
          <div>Quota C dispo: <strong>{row.quotaCouleurDispo ?? '—'}</strong></div>
          <div>Inclus N (gratuit): <strong>{row.copiesNoirIncluses ?? '—'}</strong></div>
          <div>Inclus C (gratuit): <strong>{row.copiesCouleurIncluses ?? '—'}</strong></div>
          <div>Facturable N: <strong>{row.copiesNoirFacturer}</strong></div>
          <div>Facturable C: <strong>{row.copiesCouleurFacturer}</strong></div>
          <div>Report N → mois+1: <strong>{row.quotaNoirReport ?? '—'}</strong></div>
          <div>Report C → mois+1: <strong>{row.quotaCouleurReport ?? '—'}</strong></div>
          <div>
            Alertes:{' '}
            {row.alerteDeltaHaut ? <span className="badge badge-warn">Δ haut</span> : '—'}
          </div>
          <div>
            Motif:{' '}
            <strong>
              {row.observationMotif
                ? OBSERVATION_RELEVE_LABEL[row.observationMotif]
                : '—'}
            </strong>
          </div>
          <div className="full">Observations: {row.observations ?? '—'}</div>
        </div>
      </div>

      {row.audits && row.audits.length > 0 ? (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h2>Historique modifications</h2>
          <ul className="alert-list">
            {row.audits.map((a) => (
              <li key={a.id} className="alert-item">
                <span>
                  <strong>{a.action}</strong>
                  {a.afterJson ? ` · ${a.afterJson.slice(0, 80)}` : ''}
                </span>
                <span>{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Modal
        open={editOpen}
        eyebrow="MODIFIER"
        title={`Relevé ${row.code}`}
        onClose={() => setEditOpen(false)}
        wide
        footer={
          <>
            <ModalCloseButton onClick={() => setEditOpen(false)} label="Annuler" />
            <ModalSubmitButton form="releve-edit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="releve-edit" className="modal-form" onSubmit={(e) => void onSave(e)}>
          <PageFeedback error={formError} onDismiss={() => setFormError(null)} />
          {(
            [
              'c112',
              'c113',
              'c122',
              'c123',
              'c501',
              'scanNoir',
              'scanCouleur',
              'envoi',
            ] as const
          ).map((k) => (
            <div className="modal-form-row" key={k}>
              <label>{k}</label>
              <div className="modal-field">
                <input
                  className="modal-input"
                  type="number"
                  min={0}
                  value={form[k]}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          <div className="modal-form-row">
            <label>Motif</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.observationMotif}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    observationMotif: e.target.value as '' | ObservationReleve,
                  }))
                }
              >
                <option value="">—</option>
                {(Object.keys(OBSERVATION_RELEVE_LABEL) as ObservationReleve[]).map((k) => (
                  <option key={k} value={k}>{OBSERVATION_RELEVE_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Observations</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                value={form.observations}
                onChange={(e) => setForm((p) => ({ ...p, observations: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
