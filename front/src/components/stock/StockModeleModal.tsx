'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { TableActions } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatTime, toInputDate, toInputTime } from '@/lib/format';
import {
  COULEUR_LABEL,
  type CouleurToner,
  type StockMouvement,
  type StockMouvementsResponse,
} from '@/lib/types';

type Props = {
  modeleId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

type EditForm = {
  date: string;
  heure: string;
  couleur: CouleurToner;
  qte: string;
  observations: string;
};

const COULEURS = Object.keys(COULEUR_LABEL) as CouleurToner[];

function couleurClass(couleur: CouleurToner) {
  if (couleur === 'TONER_BLACK') return 'is-black';
  if (couleur === 'TONER_CYAN') return 'is-cyan';
  if (couleur === 'TONER_MAGENTA') return 'is-magenta';
  return 'is-yellow';
}

function skuBadge(statut: string) {
  if (statut === 'EN_STOCK') return 'badge badge-ok';
  if (statut === 'PARTIELLEMENT_UTILISEE') return 'badge badge-warn';
  if (statut === 'EPUISE' || statut === 'SUR_AFFECTE') return 'badge badge-danger';
  return 'badge badge-muted';
}

export function StockModeleModal({ modeleId, onClose, onChanged }: Props) {
  const { confirm } = useFeedback();
  const titleId = useId();
  const open = !!modeleId;
  const [data, setData] = useState<StockMouvementsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StockMouvement | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(id: string) {
    setLoading(true);
    setError(null);
    try {
      const next = await api.stock.mouvements(id);
      setData(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!modeleId) {
      setData(null);
      setEditing(null);
      setForm(null);
      return;
    }
    void load(modeleId);
  }, [modeleId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null);
          setForm(null);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, editing]);

  function startEdit(row: StockMouvement) {
    setEditing(row);
    setError(null);
    setForm({
      date: toInputDate(row.date),
      heure: toInputTime(row.heure),
      couleur: row.couleur,
      qte: String(row.qte),
      observations: row.observations ?? '',
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(null);
    setError(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError(null);
    try {
      if (editing.type === 'ENTREE') {
        await api.stock.updateEntree(editing.id, {
          dateEntree: form.date,
          heureEntree: form.heure,
          couleur: form.couleur,
          qte: Number(form.qte),
          observations: form.observations || null,
        });
      } else {
        await api.stock.updateSortie(editing.id, {
          datePose: form.date,
          heurePose: form.heure,
          couleur: form.couleur,
          qte: Number(form.qte),
          observations: form.observations || null,
        });
      }
      setEditing(null);
      setForm(null);
      if (modeleId) await load(modeleId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: StockMouvement) {
    const label = row.type === 'ENTREE' ? 'cette entrée' : 'cette sortie';
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Supprimer ${label} ${row.code} (${COULEUR_LABEL[row.couleur]} × ${row.qte}) ?`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setError(null);
    try {
      if (row.type === 'ENTREE') await api.stock.removeEntree(row.id);
      else await api.stock.removeSortie(row.id);
      if (editing?.id === row.id) cancelEdit();
      if (modeleId) await load(modeleId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const modele = data?.modele;
  const mouvements = data?.mouvements ?? [];

  return createPortal(
    <div className="modal-root detail-modal-root" role="presentation">
      <button type="button" className="modal-backdrop" aria-label="Fermer" onClick={onClose} />
      <div
        className="detail-modal-dialog stock-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {loading && !data ? (
          <div className="detail-modal-loading">
            <div className="dash-loading-pulse" />
            <p>Chargement de l’historique…</p>
          </div>
        ) : !modele ? (
          <div className="detail-modal-loading">
            <p>{error ?? 'Modèle introuvable'}</p>
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <header className="modal-dialog-head">
              <div className="modal-dialog-head-text">
                <p className="modal-eyebrow">Mouvements de stock</p>
                <h2 id={titleId}>{modele.modele}</h2>
                <p className="modal-subtitle">
                  {modele.marque?.nom ?? 'Sans marque'}
                  {modele.refFabricant ? ` · ${modele.refFabricant}` : ''}
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

            <div className="stock-sku-strip">
              {(data?.skus ?? []).map((sku) => (
                <div key={sku.id} className={`stock-sku-chip ${couleurClass(sku.couleur)}`}>
                  <span className="stock-sku-dot" />
                  <div>
                    <strong>{COULEUR_LABEL[sku.couleur]}</strong>
                    <p>
                      {sku.qteRestante} restant
                      <span className={skuBadge(sku.statut)}> {sku.statut.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="detail-modal-body">
              <PageFeedback error={error} onDismiss={() => setError(null)} />

              {editing && form ? (
                <form id="stock-mouvement-form" className="modal-form" onSubmit={saveEdit}>
                  <p className="stock-edit-banner">
                    Modification de {editing.type === 'ENTREE' ? 'l’entrée' : 'la sortie'}{' '}
                    <strong className="mono">{editing.code}</strong>
                    {editing.type === 'SORTIE' ? (
                      <span> — date et heure communes à toute la pose</span>
                    ) : null}
                  </p>
                  <div className="modal-form-row">
                    <label>Date</label>
                    <div className="modal-field">
                      <input
                        className="modal-input"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Heure</label>
                    <div className="modal-field">
                      <input
                        className="modal-input"
                        type="time"
                        value={form.heure}
                        onChange={(e) => setForm({ ...form, heure: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Couleur</label>
                    <div className="modal-field">
                      <select
                        className="modal-select"
                        value={form.couleur}
                        onChange={(e) =>
                          setForm({ ...form, couleur: e.target.value as CouleurToner })
                        }
                      >
                        {COULEURS.map((c) => (
                          <option key={c} value={c}>
                            {COULEUR_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-form-row">
                    <label>Quantité</label>
                    <div className="modal-field">
                      <input
                        className="modal-input"
                        type="number"
                        min={1}
                        value={form.qte}
                        onChange={(e) => setForm({ ...form, qte: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-form-row is-top">
                    <label>Observations</label>
                    <div className="modal-field">
                      <textarea
                        className="modal-textarea"
                        value={form.observations}
                        onChange={(e) => setForm({ ...form, observations: e.target.value })}
                      />
                    </div>
                  </div>
                </form>
              ) : mouvements.length === 0 ? (
                <p className="empty-state">Aucun mouvement pour ce modèle</p>
              ) : (
                <div className="table-wrap stock-mv-wrap">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Date</th>
                          <th>Heure</th>
                          <th>Couleur</th>
                          <th data-align="right">Qté</th>
                          <th>Détail</th>
                          <th>Réf.</th>
                          <th className="col-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mouvements.map((row) => (
                          <tr key={`${row.type}-${row.id}`}>
                            <td>
                              <span
                                className={`stock-mv-tag ${row.type === 'ENTREE' ? 'is-in' : 'is-out'}`}
                              >
                                {row.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                              </span>
                            </td>
                            <td>{formatDate(row.date)}</td>
                            <td className="mono">{formatTime(row.heure)}</td>
                            <td>
                              <span className={`stock-color-label ${couleurClass(row.couleur)}`}>
                                {COULEUR_LABEL[row.couleur]}
                              </span>
                            </td>
                            <td data-align="right">
                              <strong>
                                {row.type === 'ENTREE' ? '+' : '−'}
                                {row.qte}
                              </strong>
                            </td>
                            <td>{row.detail ?? '—'}</td>
                            <td className="mono">{row.code}</td>
                            <td className="col-actions">
                              <TableActions
                                onEdit={() => startEdit(row)}
                                onDelete={() => void removeRow(row)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <footer className="detail-modal-foot">
              {editing ? (
                <div className="detail-modal-foot-right">
                  <button type="button" className="btn-modal btn-modal-ghost" onClick={cancelEdit}>
                    Retour
                  </button>
                  <ModalSubmitButton form="stock-mouvement-form" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </ModalSubmitButton>
                </div>
              ) : (
                <div className="detail-modal-foot-right">
                  <ModalCloseButton onClick={onClose} label="Fermer" />
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
