'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, TableActions, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { StockModeleModal } from '@/components/stock/StockModeleModal';
import { api, ApiError } from '@/lib/api';
import { COULEUR_LABEL, type CartoucheSku, type CouleurToner, type ModeleCartouche } from '@/lib/types';

type EntreeLigne = {
  key: string;
  modeleId: string;
  couleur: CouleurToner;
  qte: string;
};

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function newLigne(modeleId = '', couleur: CouleurToner = 'TONER_BLACK'): EntreeLigne {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    modeleId,
    couleur,
    qte: '10',
  };
}

function skuBadge(statut: string) {
  if (statut === 'EN_STOCK') return 'badge badge-ok';
  if (statut === 'PARTIELLEMENT_UTILISEE') return 'badge badge-warn';
  if (statut === 'EPUISE' || statut === 'SUR_AFFECTE') return 'badge badge-danger';
  return 'badge badge-muted';
}

export default function StockPage() {
  const [skus, setSkus] = useState<CartoucheSku[]>([]);
  const [modeles, setModeles] = useState<ModeleCartouche[]>([]);
  const [alerteOnly, setAlerteOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dateEntree: new Date().toISOString().slice(0, 10),
    heureEntree: nowTime(),
    observations: '',
    lignes: [newLigne()] as EntreeLigne[],
  });
  const { sortKey, sortDir, toggle, sort } = useTableSort<CartoucheSku>('modele');

  async function load() {
    try {
      const [s, m] = await Promise.all([
        api.stock.skus({ alerte: alerteOnly ? 'true' : undefined }),
        api.stock.modeles(),
      ]);
      setSkus(s);
      setModeles(m);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerteOnly]);

  function openModal() {
    setError(null);
    setOk(null);
    const defaultModele = modeles[0]?.id ?? '';
    setForm({
      dateEntree: new Date().toISOString().slice(0, 10),
      heureEntree: nowTime(),
      observations: '',
      lignes: [newLigne(defaultModele)],
    });
    setOpen(true);
  }

  function addLigne() {
    setForm((prev) => ({
      ...prev,
      lignes: [...prev.lignes, newLigne(modeles[0]?.id ?? '')],
    }));
  }

  function removeLigne(key: string) {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.length <= 1 ? prev.lignes : prev.lignes.filter((l) => l.key !== key),
    }));
  }

  function updateLigne(key: string, patch: Partial<EntreeLigne>) {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  async function createEntree(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const lignes = form.lignes
      .map((l) => ({
        modeleId: l.modeleId,
        couleur: l.couleur,
        qte: Number(l.qte),
      }))
      .filter((l) => l.modeleId && l.qte >= 1);

    if (lignes.length === 0) {
      setError('Ajoutez au moins un modèle avec une quantité valide');
      return;
    }

    setSaving(true);
    try {
      const created = await api.stock.createEntreesBatch({
        dateEntree: form.dateEntree,
        heureEntree: form.heureEntree,
        observations: form.observations || undefined,
        lignes,
      });
      const codes = created.map((c) => c.code).join(', ');
      setOk(`${created.length} entrée(s) créée(s) : ${codes}`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Entrée impossible');
    } finally {
      setSaving(false);
    }
  }

  const sortedSkus = useMemo(
    () =>
      sort(skus, (row, key) => {
        if (key === 'modele') return row.modele?.modele ?? '';
        if (key === 'couleur') return COULEUR_LABEL[row.couleur];
        if (key === 'qteEntrees') return row.qteEntrees;
        if (key === 'qteSorties') return row.qteSorties;
        if (key === 'qteRestante') return row.qteRestante;
        if (key === 'statut') return row.statut;
        return '';
      }),
    [skus, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Stock cartouches</h1>
          <p>Cliquez un modèle pour voir toutes les entrées et sorties</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openModal}>
          + Nouvelle entrée
        </button>
      </div>

      <div className="toolbar">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={alerteOnly}
            onChange={(e) => setAlerteOnly(e.target.checked)}
          />
          Alertes seulement
        </label>
      </div>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <Modal
        open={open}
        eyebrow="NOUVEAU"
        title="Nouvelle entrée stock"
        subtitle="Indiquez la date, l’heure et les modèles entrants."
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="stock-form" disabled={saving}>
              {saving ? 'Ajout…' : `Enregistrer (${form.lignes.length})`}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="stock-form" className="modal-form" onSubmit={createEntree}>
          <div className="modal-form-row">
            <label htmlFor="stock-date">Date</label>
            <div className="modal-field">
              <input
                id="stock-date"
                className="modal-input"
                type="date"
                value={form.dateEntree}
                onChange={(e) => setForm({ ...form, dateEntree: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label htmlFor="stock-heure">Heure</label>
            <div className="modal-field">
              <input
                id="stock-heure"
                className="modal-input"
                type="time"
                value={form.heureEntree}
                onChange={(e) => setForm({ ...form, heureEntree: e.target.value })}
              />
            </div>
          </div>

          <div className="stock-entree-lines-head">
            <span>Modèles entrants</span>
            <button type="button" className="btn btn-soft btn-sm" onClick={addLigne}>
              + Ajouter un modèle
            </button>
          </div>

          <div className="stock-entree-lines">
            {form.lignes.map((ligne, index) => (
              <div key={ligne.key} className="stock-entree-line">
                <div className="stock-entree-line-head">
                  <strong>Ligne {index + 1}</strong>
                  {form.lignes.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm btn-soft-danger"
                      onClick={() => removeLigne(ligne.key)}
                    >
                      Retirer
                    </button>
                  ) : null}
                </div>
                <div className="stock-entree-line-grid">
                  <div className="modal-field">
                    <label className="stock-inline-label">Modèle</label>
                    <select
                      className="modal-select"
                      value={ligne.modeleId}
                      onChange={(e) => updateLigne(ligne.key, { modeleId: e.target.value })}
                      required
                    >
                      <option value="">— Choisir —</option>
                      {modeles.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.modele}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="stock-inline-label">Couleur</label>
                    <select
                      className="modal-select"
                      value={ligne.couleur}
                      onChange={(e) =>
                        updateLigne(ligne.key, { couleur: e.target.value as CouleurToner })
                      }
                    >
                      {(Object.keys(COULEUR_LABEL) as CouleurToner[]).map((c) => (
                        <option key={c} value={c}>
                          {COULEUR_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="stock-inline-label">Quantité</label>
                    <input
                      className="modal-input"
                      type="number"
                      min={1}
                      value={ligne.qte}
                      onChange={(e) => updateLigne(ligne.key, { qte: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-form-row is-top">
            <label htmlFor="stock-obs">Observations</label>
            <div className="modal-field">
              <textarea
                id="stock-obs"
                className="modal-textarea"
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                placeholder="Optionnel — commun à toutes les lignes"
              />
            </div>
          </div>
        </form>
      </Modal>

      <StockModeleModal
        modeleId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => {
          setOk('Mouvement mis à jour');
          void load();
        }}
      />

      <DataTableShell empty={skus.length === 0} emptyMessage="Aucun SKU">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Modèle" sortKey="modele" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Couleur" sortKey="couleur" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Entrées" sortKey="qteEntrees" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Sorties" sortKey="qteSorties" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Restant" sortKey="qteRestante" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSkus.map((s) => (
              <tr key={s.id} className={detailId === s.modeleId ? 'is-selected' : undefined}>
                <td>
                  <button type="button" className="link-btn" onClick={() => setDetailId(s.modeleId)}>
                    {s.modele?.modele ?? '—'}
                  </button>
                </td>
                <td>{COULEUR_LABEL[s.couleur]}</td>
                <td data-align="right">{s.qteEntrees}</td>
                <td data-align="right">{s.qteSorties}</td>
                <td data-align="right"><strong>{s.qteRestante}</strong></td>
                <td><span className={skuBadge(s.statut)}>{s.statut}</span></td>
                <td className="col-actions">
                  <TableActions onView={() => setDetailId(s.modeleId)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
