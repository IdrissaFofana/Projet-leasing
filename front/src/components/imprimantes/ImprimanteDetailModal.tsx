'use client';

import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime, toInputDate } from '@/lib/format';
import {
  COULEUR_LABEL,
  STATUT_IMP_LABEL,
  type Affectation,
  type Imprimante,
  type Maintenance,
  type NamedRef,
  type Releve,
  type StatutImprimante,
} from '@/lib/types';

type Mode = 'view' | 'edit' | 'history';

type Props = {
  printerId: string | null;
  initialMode?: Mode;
  marques: NamedRef[];
  fournisseurs: NamedRef[];
  services: NamedRef[];
  onClose: () => void;
  onUpdated: (printer: Imprimante) => void;
  onDeleted: () => void;
};

type TimelineEvent = {
  id: string;
  kind: 'INSTALLATION' | 'AFFECTATION' | 'MAINTENANCE' | 'RELEVE';
  date: string;
  heure?: string | null;
  title: string;
  detail: string;
  code?: string;
};

function statutBadge(statut: StatutImprimante) {
  if (statut === 'FONCTIONNELLE') return 'badge badge-ok';
  if (statut === 'EN_MAINTENANCE') return 'badge badge-warn';
  if (statut === 'HORS_SERVICE') return 'badge badge-danger';
  return 'badge badge-muted';
}

function kindLabel(kind: TimelineEvent['kind']) {
  if (kind === 'INSTALLATION') return 'Installation';
  if (kind === 'AFFECTATION') return 'Affectation';
  if (kind === 'MAINTENANCE') return 'Maintenance';
  return 'Relevé';
}

function DetailCard({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`detail-card${wide ? ' is-wide' : ''}`}>
      <span className="detail-card-label">{label}</span>
      <span className={`detail-card-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

export function ImprimanteDetailModal({
  printerId,
  initialMode = 'view',
  marques,
  fournisseurs,
  services,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const { confirm } = useFeedback();
  const titleId = useId();
  const open = !!printerId;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [row, setRow] = useState<Imprimante | null>(null);
  const [draft, setDraft] = useState<Imprimante | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [releves, setReleves] = useState<Releve[]>([]);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!printerId) {
      setRow(null);
      setDraft(null);
      setAffectations([]);
      setMaintenances([]);
      setReleves([]);
      setHistoryLoadedFor(null);
      return;
    }
    setMode(initialMode === 'edit' ? 'edit' : initialMode === 'history' ? 'history' : 'view');
    setLoading(true);
    setError(null);
    api.printers
      .get(printerId)
      .then((p) => {
        setRow(p);
        setDraft({ ...p });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, [printerId, initialMode]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  async function loadHistory(id: string) {
    setHistoryLoading(true);
    try {
      const [aff, maint, rel] = await Promise.all([
        api.assignments.list({ imprimanteId: id }),
        api.maintenance.list({ imprimanteId: id }),
        api.readings.list({ imprimanteId: id }),
      ]);
      setAffectations(aff);
      setMaintenances(maint);
      setReleves(rel);
      setHistoryLoadedFor(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Historique impossible à charger');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (mode === 'history' && printerId && historyLoadedFor !== printerId) {
      void loadHistory(printerId);
    }
  }, [mode, printerId, historyLoadedFor]);

  const timeline = useMemo(() => {
    if (!row) return [] as TimelineEvent[];
    const events: TimelineEvent[] = [];

    if (row.dateInstallation) {
      events.push({
        id: `install-${row.id}`,
        kind: 'INSTALLATION',
        date: row.dateInstallation,
        title: 'Mise en service',
        detail: `Copieur installé${row.localisation ? ` · ${row.localisation}` : ''}`,
      });
    }

    for (const a of affectations) {
      const cartouches = (a.lignes ?? [])
        .map((l) => `${COULEUR_LABEL[l.couleur]}×${l.qte}`)
        .join(', ');
      events.push({
        id: `aff-${a.id}`,
        kind: 'AFFECTATION',
        date: a.datePose,
        heure: a.heurePose,
        title: `Pose cartouche${a.modele?.modele ? ` · ${a.modele.modele}` : ''}`,
        detail: cartouches || 'Sans détail de lignes',
        code: a.code,
      });
    }

    for (const m of maintenances) {
      events.push({
        id: `maint-${m.id}`,
        kind: 'MAINTENANCE',
        date: m.dateMaintenance,
        title: `Maintenance · ${m.type.replace(/_/g, ' ')}`,
        detail:
          m.actionsRealisees ||
          m.observations ||
          (m.technicien?.nom ? `Technicien : ${m.technicien.nom}` : 'Intervention enregistrée'),
        code: m.code,
      });
    }

    for (const r of releves) {
      events.push({
        id: `rel-${r.id}`,
        kind: 'RELEVE',
        date: r.dateReleve,
        title: `Relevé ${r.moisFacture}`,
        detail: `Noir ${r.totalNoir.toLocaleString('fr-FR')} · Couleur ${r.totalCouleur.toLocaleString('fr-FR')} · ${r.statut.replace(/_/g, ' ')}`,
        code: r.code,
      });
    }

    return events.sort((a, b) => {
      const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDate !== 0) return byDate;
      const ha = a.heure ? new Date(a.heure).getTime() : 0;
      const hb = b.heure ? new Date(b.heure).getTime() : 0;
      return hb - ha;
    });
  }, [row, affectations, maintenances, releves]);

  function setField<K extends keyof Imprimante>(key: K, value: Imprimante[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function switchMode(next: Mode) {
    if (next === 'view' && row) setDraft({ ...row });
    setMode(next);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.printers.update(draft.id, {
        modele: draft.modele,
        numeroSerie: draft.numeroSerie,
        marqueId: draft.marqueId,
        fournisseurId: draft.fournisseurId,
        serviceId: draft.serviceId,
        localisation: draft.localisation,
        statut: draft.statut,
        dateInstallation: draft.dateInstallation
          ? toInputDate(draft.dateInstallation)
          : null,
        prochaineMaintenance: draft.prochaineMaintenance
          ? toInputDate(draft.prochaineMaintenance)
          : null,
        compteursInitiauxSaisis: draft.compteursInitiauxSaisis ?? false,
        dateCompteursInitiaux: draft.compteursInitiauxSaisis
          ? draft.dateCompteursInitiaux
            ? toInputDate(draft.dateCompteursInitiaux)
            : null
          : undefined,
        c112Init: draft.compteursInitiauxSaisis ? draft.c112Init ?? 0 : undefined,
        c113Init: draft.compteursInitiauxSaisis ? draft.c113Init ?? 0 : undefined,
        c122Init: draft.compteursInitiauxSaisis ? draft.c122Init ?? 0 : undefined,
        c123Init: draft.compteursInitiauxSaisis ? draft.c123Init ?? 0 : undefined,
        c501Init: draft.compteursInitiauxSaisis ? draft.c501Init ?? null : undefined,
        scanNoirInit: draft.compteursInitiauxSaisis ? draft.scanNoirInit ?? 0 : undefined,
        scanCouleurInit: draft.compteursInitiauxSaisis ? draft.scanCouleurInit ?? 0 : undefined,
        envoiInit: draft.compteursInitiauxSaisis ? draft.envoiInit ?? 0 : undefined,
        observations: draft.observations,
      });
      setRow(updated);
      setDraft({ ...updated });
      setMode('view');
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  }

  async function retire() {
    if (!row) return;
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Retirer ${row.code} du parc ?`,
        danger: true,
        confirmLabel: 'Retirer',
      }))
    )
      return;
    try {
      await api.printers.remove(row.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-root detail-modal-root" role="presentation">
      <button type="button" className="modal-backdrop" aria-label="Fermer" onClick={onClose} />
      <div
        className="detail-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {loading ? (
          <div className="detail-modal-loading">
            <div className="dash-loading-pulse" />
            <p>Chargement de la fiche…</p>
          </div>
        ) : !row ? (
          <div className="detail-modal-loading">
            <p>{error ?? 'Copieur introuvable'}</p>
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <header className="modal-dialog-head">
              <div className="modal-dialog-head-text">
                <p className="modal-eyebrow">Fiche copieur</p>
                <h2 id={titleId}>{row.code}</h2>
                <p className="modal-subtitle">
                  {row.modele}
                  <span className="mono"> · {row.numeroSerie}</span>
                  {' · '}
                  {STATUT_IMP_LABEL[row.statut]}
                </p>
              </div>
              <button
                type="button"
                className="modal-dialog-close"
                aria-label="Fermer"
                onClick={onClose}
              >
                ×
              </button>
            </header>
            <div className="modal-head-rule" aria-hidden />

            <div className="detail-modal-tabs">
              <button
                type="button"
                className={`detail-modal-tab${mode === 'view' ? ' is-active' : ''}`}
                onClick={() => switchMode('view')}
              >
                Aperçu
              </button>
              <button
                type="button"
                className={`detail-modal-tab${mode === 'history' ? ' is-active' : ''}`}
                onClick={() => switchMode('history')}
              >
                Historique
              </button>
              <button
                type="button"
                className={`detail-modal-tab${mode === 'edit' ? ' is-active' : ''}`}
                onClick={() => switchMode('edit')}
              >
                Modifier
              </button>
            </div>

            <div className="detail-modal-body">
              <PageFeedback error={error} onDismiss={() => setError(null)} />

              {mode === 'view' ? (
                <>
                  <div className="detail-modal-grid">
                    <DetailCard label="Marque" value={row.marque?.nom ?? '—'} />
                    <DetailCard label="Fournisseur" value={row.fournisseur?.nom ?? '—'} />
                    <DetailCard label="Service" value={row.service?.nom ?? '—'} />
                    <DetailCard label="Localisation" value={row.localisation ?? '—'} wide />
                  </div>
                  <div className="detail-modal-timeline">
                    <div className="detail-timeline-item">
                      <span className="detail-timeline-dot" />
                      <div>
                        <strong>Installation</strong>
                        <p>{formatDate(row.dateInstallation)}</p>
                      </div>
                    </div>
                    <div className="detail-timeline-item">
                      <span className="detail-timeline-dot is-accent" />
                      <div>
                        <strong>Prochaine maintenance</strong>
                        <p>{formatDate(row.prochaineMaintenance)}</p>
                      </div>
                    </div>
                  </div>
                  {row.observations ? (
                    <div className="detail-modal-notes">
                      <span className="detail-card-label">Observations</span>
                      <p>{row.observations}</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {mode === 'history' ? (
                historyLoading ? (
                  <div className="detail-modal-loading">
                    <div className="dash-loading-pulse" />
                    <p>Chargement de l’historique…</p>
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="empty-state">Aucun événement enregistré pour ce copieur</p>
                ) : (
                  <ol className="imp-chrono">
                    {timeline.map((ev) => (
                      <li key={ev.id} className={`imp-chrono-item is-${ev.kind.toLowerCase()}`}>
                        <span className="imp-chrono-rail" aria-hidden />
                        <div className="imp-chrono-card">
                          <div className="imp-chrono-head">
                            <span className={`imp-chrono-tag is-${ev.kind.toLowerCase()}`}>
                              {kindLabel(ev.kind)}
                            </span>
                            <time>{formatDateTime(ev.date, ev.heure)}</time>
                          </div>
                          <strong>{ev.title}</strong>
                          <p>{ev.detail}</p>
                          {ev.code ? <span className="mono imp-chrono-code">{ev.code}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              ) : null}

              {mode === 'edit' && draft ? (
                <form id="imprimante-detail-form" className="modal-form" onSubmit={onSubmit}>
                  <div className="modal-form-row">
                    <label>Modèle</label>
                    <div className="modal-field">
                      <input className="modal-input" value={draft.modele} onChange={(e) => setField('modele', e.target.value)} required />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>N° série</label>
                    <div className="modal-field">
                      <input className="modal-input" value={draft.numeroSerie} onChange={(e) => setField('numeroSerie', e.target.value)} required />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Marque</label>
                    <div className="modal-field">
                      <select className="modal-select" value={draft.marqueId ?? ''} onChange={(e) => setField('marqueId', e.target.value || null)}>
                        <option value="">—</option>
                        {marques.map((m) => (<option key={m.id} value={m.id}>{m.nom}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Fournisseur</label>
                    <div className="modal-field">
                      <select className="modal-select" value={draft.fournisseurId ?? ''} onChange={(e) => setField('fournisseurId', e.target.value || null)}>
                        <option value="">—</option>
                        {fournisseurs.map((f) => (<option key={f.id} value={f.id}>{f.nom}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Service</label>
                    <div className="modal-field">
                      <select className="modal-select" value={draft.serviceId ?? ''} onChange={(e) => setField('serviceId', e.target.value || null)}>
                        <option value="">—</option>
                        {services.map((s) => (<option key={s.id} value={s.id}>{s.nom}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Statut</label>
                    <div className="modal-field">
                      <select className="modal-select" value={draft.statut} onChange={(e) => setField('statut', e.target.value as StatutImprimante)}>
                        {Object.entries(STATUT_IMP_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Localisation</label>
                    <div className="modal-field">
                      <input className="modal-input" value={draft.localisation ?? ''} onChange={(e) => setField('localisation', e.target.value)} />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Date installation</label>
                    <div className="modal-field">
                      <input className="modal-input" type="date" value={toInputDate(draft.dateInstallation)} onChange={(e) => setField('dateInstallation', e.target.value || null)} />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Compteurs initiaux (pose)</label>
                    <div className="modal-field">
                      <label className="checkbox-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={draft.compteursInitiauxSaisis ?? false}
                          onChange={(e) => setField('compteursInitiauxSaisis', e.target.checked)}
                        />
                        <span>Utiliser ce point de départ pour le 1er relevé</span>
                      </label>
                    </div>
                  </div>
                  {draft.compteursInitiauxSaisis ? (
                    <>
                      <div className="modal-form-row">
                        <label>Date compteurs initiaux</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="date"
                            value={toInputDate(draft.dateCompteursInitiaux)}
                            onChange={(e) => setField('dateCompteursInitiaux', e.target.value || null)}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>112 (Noir grand)</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.c112Init ?? 0}
                            onChange={(e) => setField('c112Init', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>113 (Noir petit)</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.c113Init ?? 0}
                            onChange={(e) => setField('c113Init', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>122 (Couleur grand)</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.c122Init ?? 0}
                            onChange={(e) => setField('c122Init', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>123 (Couleur petit)</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.c123Init ?? 0}
                            onChange={(e) => setField('c123Init', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>501 (Scan total)</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.c501Init ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setField('c501Init', v === '' ? null : Number(v));
                            }}
                            placeholder="Optionnel"
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>Scan noir initial</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.scanNoirInit ?? 0}
                            onChange={(e) => setField('scanNoirInit', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>Scan couleur initial</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.scanCouleurInit ?? 0}
                            onChange={(e) => setField('scanCouleurInit', Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="modal-form-row">
                        <label>Envoi initial</label>
                        <div className="modal-field">
                          <input
                            className="modal-input"
                            type="number"
                            min={0}
                            value={draft.envoiInit ?? 0}
                            onChange={(e) => setField('envoiInit', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className="modal-form-row">
                    <label>Prochaine maintenance</label>
                    <div className="modal-field">
                      <input className="modal-input" type="date" value={toInputDate(draft.prochaineMaintenance)} onChange={(e) => setField('prochaineMaintenance', e.target.value || null)} />
                    </div>
                  </div>
                  <div className="modal-form-row is-top">
                    <label>Observations</label>
                    <div className="modal-field">
                      <textarea className="modal-textarea" value={draft.observations ?? ''} onChange={(e) => setField('observations', e.target.value)} />
                    </div>
                  </div>
                </form>
              ) : null}
            </div>

            <footer className="detail-modal-foot">
              {mode === 'edit' ? (
                <div className="detail-modal-foot-right">
                  <ModalCloseButton onClick={onClose} label="Annuler" />
                  <ModalSubmitButton form="imprimante-detail-form" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </ModalSubmitButton>
                </div>
              ) : (
                <div className="detail-modal-foot-right is-split">
                  <button type="button" className="btn-modal btn-modal-ghost" onClick={() => void retire()}>
                    Retirer
                  </button>
                  {mode === 'history' ? (
                    <button type="button" className="btn-modal btn-modal-primary" onClick={() => switchMode('view')}>
                      Aperçu
                    </button>
                  ) : (
                    <button type="button" className="btn-modal btn-modal-primary" onClick={() => switchMode('edit')}>
                      Modifier
                    </button>
                  )}
                </div>
              )}
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
