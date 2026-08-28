'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { ModalCloseButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  COULEUR_LABEL,
  STATUT_IMP_LABEL,
  type Affectation,
  type CouleurToner,
  type StatutImprimante,
} from '@/lib/types';

type Props = {
  affectationId: string | null;
  onClose: () => void;
  onEdit?: (row: Affectation) => void;
  onDelete?: (row: Affectation) => void;
};

function couleurClass(couleur: CouleurToner) {
  if (couleur === 'TONER_BLACK') return 'is-black';
  if (couleur === 'TONER_CYAN') return 'is-cyan';
  if (couleur === 'TONER_MAGENTA') return 'is-magenta';
  return 'is-yellow';
}

function statutBadge(statut?: StatutImprimante) {
  if (!statut) return 'badge badge-muted';
  if (statut === 'FONCTIONNELLE') return 'badge badge-ok';
  if (statut === 'EN_MAINTENANCE') return 'badge badge-warn';
  if (statut === 'HORS_SERVICE') return 'badge badge-danger';
  return 'badge badge-muted';
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

export function AffectationDetailModal({
  affectationId,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const titleId = useId();
  const open = !!affectationId;
  const [row, setRow] = useState<Affectation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!affectationId) {
      setRow(null);
      return;
    }
    setLoading(true);
    setError(null);
    api.assignments
      .get(affectationId)
      .then(setRow)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, [affectationId]);

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

  if (!open || typeof document === 'undefined') return null;

  const printer = row?.imprimante;
  const lignes = row?.lignes ?? [];
  const totalQte = lignes.reduce((s, l) => s + l.qte, 0);

  return createPortal(
    <div className="modal-root detail-modal-root" role="presentation">
      <button type="button" className="modal-backdrop" aria-label="Fermer" onClick={onClose} />
      <div
        className="detail-modal-dialog stock-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {loading && !row ? (
          <div className="detail-modal-loading">
            <div className="dash-loading-pulse" />
            <p>Chargement de la pose…</p>
          </div>
        ) : !row ? (
          <div className="detail-modal-loading">
            <p>{error ?? 'Affectation introuvable'}</p>
            <button type="button" className="btn btn-soft" onClick={onClose}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            <header className="modal-dialog-head">
              <div className="modal-dialog-head-text">
                <p className="modal-eyebrow">Détail affectation</p>
                <h2 id={titleId}>{row.code}</h2>
                <p className="modal-subtitle">
                  {formatDateTime(row.datePose, row.heurePose)}
                  {row.motif ? ` · ${row.motif.replace(/_/g, ' ')}` : ''}
                  {row.statutPose ? ` · ${row.statutPose}` : ''}
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

            <div className="detail-modal-body">
              <PageFeedback error={error} onDismiss={() => setError(null)} />

              <section className="aff-detail-section">
                <h3 className="aff-detail-section-title">Copieur</h3>
                {printer ? (
                  <div className="detail-modal-grid">
                    <DetailCard label="Code" value={printer.code} mono />
                    <DetailCard label="Modèle" value={printer.modele} />
                    <DetailCard label="N° série" value={printer.numeroSerie} mono />
                    <DetailCard
                      label="Statut"
                      value={
                        <span className={statutBadge(printer.statut)}>
                          {STATUT_IMP_LABEL[printer.statut]}
                        </span>
                      }
                    />
                    <DetailCard label="Marque" value={printer.marque?.nom ?? '—'} />
                    <DetailCard label="Service" value={printer.service?.nom ?? '—'} />
                    <DetailCard label="Localisation" value={printer.localisation ?? '—'} wide />
                  </div>
                ) : (
                  <p className="empty-state">Copieur non chargé</p>
                )}
              </section>

              <section className="aff-detail-section">
                <div className="aff-detail-section-head">
                  <h3 className="aff-detail-section-title">Cartouches posées</h3>
                  <span className="aff-detail-meta">
                    {row.modele?.modele ?? '—'} · {totalQte} unité(s)
                  </span>
                </div>
                {lignes.length === 0 ? (
                  <p className="empty-state">Aucune ligne cartouche</p>
                ) : (
                  <div className="aff-cartridge-grid">
                    {lignes.map((l) => (
                      <div key={l.id} className={`aff-cartridge-card ${couleurClass(l.couleur)}`}>
                        <span className="stock-sku-dot" />
                        <div>
                          <strong>{COULEUR_LABEL[l.couleur]}</strong>
                          <p>
                            Quantité <b>×{l.qte}</b>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {row.observations ? (
                <div className="detail-modal-notes">
                  <span className="detail-card-label">Observations</span>
                  <p>{row.observations}</p>
                </div>
              ) : null}
            </div>

            <footer className="modal-dialog-foot is-equal">
              <div className="modal-dialog-foot-left" style={{ display: 'flex', gap: '0.5rem' }}>
                {onEdit ? (
                  <button type="button" className="btn btn-soft" onClick={() => onEdit(row)}>
                    Modifier
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => onDelete(row)}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
              <div className="modal-dialog-foot-right">
                <ModalCloseButton onClick={onClose} label="Fermer" />
              </div>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
