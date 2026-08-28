'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, TableActions, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  STATUT_STOCK_PRODUIT_LABEL,
  type ClientRef,
  type StatutStockProduit,
  type StockProduit,
  type StockProduitSummary,
} from '@/lib/types';

type FormState = {
  designation: string;
  reference: string;
  fournisseur: string;
  qteRecue: string;
  dateReception: string;
  bonReception: string;
  qteLivree: string;
  dateLivraison: string;
  clientId: string;
  bonLivraison: string;
  observations: string;
};

type SortieForm = {
  qte: string;
  dateLivraison: string;
  clientId: string;
  bonLivraison: string;
  observations: string;
};

const emptyForm = (): FormState => ({
  designation: '',
  reference: '',
  fournisseur: '',
  qteRecue: '1',
  dateReception: new Date().toISOString().slice(0, 10),
  bonReception: '',
  qteLivree: '0',
  dateLivraison: '',
  clientId: '',
  bonLivraison: '',
  observations: '',
});

const emptySortie = (row?: StockProduit | null): SortieForm => ({
  qte: '1',
  dateLivraison: new Date().toISOString().slice(0, 10),
  clientId: row?.clientId ?? '',
  bonLivraison: '',
  observations: '',
});

function statutBadge(statut: StatutStockProduit) {
  if (statut === 'EN_STOCK') return 'badge badge-ok';
  if (statut === 'PARTIELLEMENT_LIVRE') return 'badge badge-warn';
  if (statut === 'LIVRE') return 'badge badge-info';
  if (statut === 'ANNULE') return 'badge badge-danger';
  return 'badge badge-muted';
}

export default function StockProduitsPage() {
  const { confirm } = useFeedback();
  const [rows, setRows] = useState<StockProduit[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [summary, setSummary] = useState<StockProduitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');
  const [open, setOpen] = useState(false);
  const [sortieOpen, setSortieOpen] = useState(false);
  const [editing, setEditing] = useState<StockProduit | null>(null);
  const [sortieRow, setSortieRow] = useState<StockProduit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [sortieForm, setSortieForm] = useState<SortieForm>(emptySortie());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDir, toggle, sort } = useTableSort<StockProduit>('numero', 'desc');

  const activeClients = useMemo(
    () => clients.filter((c) => c.actif !== false),
    [clients],
  );

  async function load() {
    setLoading(true);
    try {
      const [list, sum, clientsList] = await Promise.all([
        api.stockProduits.list({
          q: q.trim() || undefined,
          statut: (statut as StatutStockProduit) || undefined,
        }),
        api.stockProduits.summary(),
        api.clients.list(),
      ]);
      setRows(list);
      setSummary(sum);
      setClients(clientsList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOk(null);
    setOpen(true);
  }

  function openEdit(row: StockProduit) {
    setEditing(row);
    setForm({
      designation: row.designation,
      reference: row.reference ?? '',
      fournisseur: row.fournisseur ?? '',
      qteRecue: String(row.qteRecue),
      dateReception: row.dateReception?.slice(0, 10) ?? '',
      bonReception: row.bonReception ?? '',
      qteLivree: String(row.qteLivree),
      dateLivraison: row.dateLivraison?.slice(0, 10) ?? '',
      clientId: row.clientId ?? '',
      bonLivraison: row.bonLivraison ?? '',
      observations: row.observations ?? '',
    });
    setError(null);
    setOk(null);
    setOpen(true);
  }

  function openSortie(row: StockProduit) {
    if (row.qteRestante <= 0) {
      setError(`N° ${row.numero} : plus de stock restant`);
      return;
    }
    setSortieRow(row);
    setSortieForm(emptySortie(row));
    setError(null);
    setOk(null);
    setSortieOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload: Record<string, unknown> = {
        designation: form.designation.trim(),
        qteRecue: Math.max(0, Number(form.qteRecue) || 0),
        qteLivree: Math.max(0, Number(form.qteLivree) || 0),
        statutManuel: false,
      };
      if (form.reference.trim()) payload.reference = form.reference.trim();
      else if (editing) payload.reference = '';
      if (form.fournisseur.trim()) payload.fournisseur = form.fournisseur.trim();
      else if (editing) payload.fournisseur = '';
      if (form.dateReception) payload.dateReception = form.dateReception;
      else if (editing) payload.dateReception = null;
      if (form.bonReception.trim()) payload.bonReception = form.bonReception.trim();
      else if (editing) payload.bonReception = '';
      if (form.dateLivraison) payload.dateLivraison = form.dateLivraison;
      else if (editing) payload.dateLivraison = null;
      if (form.clientId) payload.clientId = form.clientId;
      else if (editing) payload.clientId = null;
      if (form.bonLivraison.trim()) payload.bonLivraison = form.bonLivraison.trim();
      else if (editing) payload.bonLivraison = '';
      if (form.observations.trim()) payload.observations = form.observations.trim();
      else if (editing) payload.observations = '';

      if (editing) {
        const updated = await api.stockProduits.update(editing.id, payload);
        setOk(`Ligne N° ${updated.numero} mise à jour`);
      } else {
        const created = await api.stockProduits.create(payload);
        setOk(`Ligne N° ${created.numero} créée`);
      }
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function submitSortie(e: FormEvent) {
    e.preventDefault();
    if (!sortieRow) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const qte = Math.max(1, Number(sortieForm.qte) || 0);
      const updated = await api.stockProduits.sortie(sortieRow.id, {
        qte,
        dateLivraison: sortieForm.dateLivraison || undefined,
        clientId: sortieForm.clientId,
        bonLivraison: sortieForm.bonLivraison.trim() || undefined,
        observations: sortieForm.observations.trim() || undefined,
      });
      setOk(
        `Sortie de ${qte} enregistrée — N° ${updated.numero} (restant ${updated.qteRestante})`,
      );
      setSortieOpen(false);
      setSortieRow(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sortie impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: StockProduit) {
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Supprimer la ligne N° ${row.numero} — ${row.designation} ?`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setError(null);
    try {
      await api.stockProduits.remove(row.id);
      setOk(`Ligne N° ${row.numero} supprimée`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const sorted = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'numero') return row.numero;
        if (key === 'designation') return row.designation;
        if (key === 'reference') return row.reference ?? '';
        if (key === 'fournisseur') return row.fournisseur ?? '';
        if (key === 'qteRecue') return row.qteRecue;
        if (key === 'qteLivree') return row.qteLivree;
        if (key === 'qteRestante') return row.qteRestante;
        if (key === 'destinataire') return row.client?.nom ?? row.destinataire ?? '';
        if (key === 'statut') return row.statut;
        if (key === 'dateReception') return row.dateReception ?? '';
        return '';
      }),
    [rows, sort],
  );

  const linesWithStock = useMemo(
    () => rows.filter((r) => r.qteRestante > 0).sort((a, b) => b.numero - a.numero),
    [rows],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Stock produits</h1>
          <p>Réceptions et sorties de produits (toners, consommables, etc.) — hors leasing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-soft" onClick={() => {
            setError(null);
            setOk(null);
            if (linesWithStock.length === 0) {
              setError('Aucune ligne avec stock restant');
              return;
            }
            openSortie(linesWithStock[0]);
          }}>
            + Sortie
          </button>
          <button type="button" className="btn btn-esay" onClick={openCreate}>
            + Nouvelle réception
          </button>
        </div>
      </div>

      {summary ? (
        <div className="toolbar" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-info">{summary.totalLignes} lignes</span>
          <span className="muted">Reçu : <strong>{summary.qteRecue}</strong></span>
          <span className="muted">Livré : <strong>{summary.qteLivree}</strong></span>
          <span className="muted">
            Restant : <strong>{summary.qteRestante}</strong>
          </span>
        </div>
      ) : null}

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Désignation, référence, fournisseur, destinataire…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <select className="select" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {(Object.keys(STATUT_STOCK_PRODUIT_LABEL) as StatutStockProduit[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_STOCK_PRODUIT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-soft"
          onClick={() =>
            void load().catch((e) =>
              setError(e instanceof ApiError ? e.message : 'Filtre impossible'),
            )
          }
        >
          Filtrer
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

      <Modal
        open={open}
        wide
        eyebrow={editing ? 'MODIFIER' : 'RÉCEPTION'}
        title={editing ? `Modifier N° ${editing.numero}` : 'Nouvelle réception'}
        subtitle="Le stock restant et le statut sont calculés automatiquement (reçu − livré)."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="stock-produit-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="stock-produit-form" className="modal-form" onSubmit={submit}>
          <div className="modal-form-row">
            <label>Désignation</label>
            <div className="modal-field">
              <input
                className="modal-input"
                required
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Référence</label>
            <div className="modal-field">
              <input
                className="modal-input"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Fournisseur</label>
            <div className="modal-field">
              <input
                className="modal-input"
                value={form.fournisseur}
                onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Qté reçue</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="number"
                min={0}
                required
                value={form.qteRecue}
                onChange={(e) => setForm({ ...form, qteRecue: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Date réception</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                value={form.dateReception}
                onChange={(e) => setForm({ ...form, dateReception: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>N° bon réception</label>
            <div className="modal-field">
              <input
                className="modal-input"
                value={form.bonReception}
                onChange={(e) => setForm({ ...form, bonReception: e.target.value })}
              />
            </div>
          </div>
          {editing ? (
            <>
              <div className="modal-form-row">
                <label>Qté livrée</label>
                <div className="modal-field">
                  <input
                    className="modal-input"
                    type="number"
                    min={0}
                    value={form.qteLivree}
                    onChange={(e) => setForm({ ...form, qteLivree: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-form-row">
                <label>Date livraison</label>
                <div className="modal-field">
                  <input
                    className="modal-input"
                    type="date"
                    value={form.dateLivraison}
                    onChange={(e) => setForm({ ...form, dateLivraison: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-form-row">
                <label>Client destinataire</label>
                <div className="modal-field">
                  <select
                    className="modal-select"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  >
                    <option value="">— Aucun —</option>
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                        {c.telephone ? ` · ${c.telephone}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Créer un client dans Référentiels → Clients
                  </p>
                </div>
              </div>
              <div className="modal-form-row">
                <label>N° bon livraison</label>
                <div className="modal-field">
                  <input
                    className="modal-input"
                    value={form.bonLivraison}
                    onChange={(e) => setForm({ ...form, bonLivraison: e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : null}
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
      </Modal>

      <Modal
        open={sortieOpen}
        wide
        eyebrow="SORTIE"
        title={
          sortieRow
            ? `Sortie — N° ${sortieRow.numero}`
            : 'Sortie de stock'
        }
        subtitle={
          sortieRow
            ? `${sortieRow.designation} · restant ${sortieRow.qteRestante}`
            : 'Décrémente le stock restant (ajoute à la quantité livrée).'
        }
        onClose={() => {
          setSortieOpen(false);
          setSortieRow(null);
        }}
        footer={
          <>
            <ModalCloseButton
              onClick={() => {
                setSortieOpen(false);
                setSortieRow(null);
              }}
              label="Annuler"
            />
            <ModalSubmitButton form="stock-produit-sortie-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la sortie'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="stock-produit-sortie-form" className="modal-form" onSubmit={submitSortie}>
          <div className="modal-form-row">
            <label>Ligne produit</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={sortieRow?.id ?? ''}
                onChange={(e) => {
                  const next = rows.find((r) => r.id === e.target.value);
                  if (!next) return;
                  setSortieRow(next);
                  setSortieForm((prev) => ({
                    ...prev,
                    clientId: next.clientId ?? prev.clientId,
                  }));
                }}
              >
                {linesWithStock.map((r) => (
                  <option key={r.id} value={r.id}>
                    N° {r.numero} — {r.designation} (restant {r.qteRestante})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Qté à sortir</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="number"
                min={1}
                max={sortieRow?.qteRestante ?? undefined}
                required
                value={sortieForm.qte}
                onChange={(e) => setSortieForm({ ...sortieForm, qte: e.target.value })}
              />
              {sortieRow ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  Maximum : {sortieRow.qteRestante}
                </p>
              ) : null}
            </div>
          </div>
          <div className="modal-form-row">
            <label>Date livraison</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                required
                value={sortieForm.dateLivraison}
                onChange={(e) =>
                  setSortieForm({ ...sortieForm, dateLivraison: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Client destinataire</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={sortieForm.clientId}
                onChange={(e) =>
                  setSortieForm({ ...sortieForm, clientId: e.target.value })
                }
              >
                <option value="">— Sélectionner un client —</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                    {c.telephone ? ` · ${c.telephone}` : ''}
                  </option>
                ))}
              </select>
              {activeClients.length === 0 ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  Aucun client — ajoutez-en dans Référentiels → Clients
                </p>
              ) : null}
            </div>
          </div>
          <div className="modal-form-row">
            <label>N° bon livraison</label>
            <div className="modal-field">
              <input
                className="modal-input"
                value={sortieForm.bonLivraison}
                onChange={(e) =>
                  setSortieForm({ ...sortieForm, bonLivraison: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Observations</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                value={sortieForm.observations}
                onChange={(e) =>
                  setSortieForm({ ...sortieForm, observations: e.target.value })
                }
              />
            </div>
          </div>
        </form>
      </Modal>

      <DataTableShell
        loading={loading}
        empty={!loading && sorted.length === 0}
        emptyMessage="Aucune ligne produit"
      >
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="N°" sortKey="numero" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Désignation" sortKey="designation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Référence" sortKey="reference" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Fournisseur" sortKey="fournisseur" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Reçu" sortKey="qteRecue" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Livré" sortKey="qteLivree" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Restant" sortKey="qteRestante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Réception" sortKey="dateReception" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Destinataire" sortKey="destinataire" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.numero}</td>
                <td>{r.designation}</td>
                <td className="mono">{r.reference ?? '—'}</td>
                <td>{r.fournisseur ?? '—'}</td>
                <td>{r.qteRecue}</td>
                <td>{r.qteLivree}</td>
                <td>
                  <strong>{r.qteRestante}</strong>
                </td>
                <td>{formatDate(r.dateReception)}</td>
                <td>{r.client?.nom ?? r.destinataire ?? '—'}</td>
                <td>
                  <span className={statutBadge(r.statut)}>
                    {STATUT_STOCK_PRODUIT_LABEL[r.statut]}
                  </span>
                </td>
                <td className="col-actions">
                  <TableActions
                    onEdit={() => openEdit(r)}
                    onDelete={() => void removeRow(r)}
                  >
                    {r.qteRestante > 0 ? (
                      <button
                        type="button"
                        className="tbl-btn"
                        title="Sortie"
                        onClick={() => openSortie(r)}
                      >
                        ↓
                      </button>
                    ) : null}
                  </TableActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
