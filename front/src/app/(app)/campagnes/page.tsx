'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { useRouter } from 'next/navigation';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { currentMois, formatDate } from '@/lib/format';
import type { Campagne, Imprimante, PorteeCampagne } from '@/lib/types';

export default function CampagnesPage() {
  const router = useRouter();
  const { confirm } = useFeedback();
  const { hasCrudPermission } = useAuth();
  const canCreate = hasCrudPermission('campaigns', 'create');
  const canDelete = hasCrudPermission('campaigns', 'delete');
  const [rows, setRows] = useState<Campagne[]>([]);
  const [mois, setMois] = useState(currentMois());
  const [dateReleve, setDateReleve] = useState(new Date().toISOString().slice(0, 10));
  const [portee, setPortee] = useState<PorteeCampagne>('ALL');
  const [printers, setPrinters] = useState<Imprimante[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printerQ, setPrinterQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { sortKey, sortDir, toggle, sort } = useTableSort<Campagne>('mois', 'desc');

  async function load() {
    setLoading(true);
    try {
      setRows(await api.campaigns.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openCreateModal() {
    setError(null);
    setMois(currentMois());
    setDateReleve(new Date().toISOString().slice(0, 10));
    setPortee('ALL');
    setSelectedIds(new Set());
    setPrinterQ('');
    setOpen(true);
    try {
      const list = await api.printers.list();
      setPrinters(list.filter((p) => p.statut !== 'RETIREE'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de charger les copieurs');
    }
  }

  const filteredPrinters = useMemo(() => {
    if (!printerQ.trim()) return printers;
    const q = printerQ.toLowerCase();
    return printers.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        (p.localisation ?? '').toLowerCase().includes(q) ||
        (p.modele ?? '').toLowerCase().includes(q),
    );
  }, [printers, printerQ]);

  function togglePrinter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filteredPrinters.map((p) => p.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (portee === 'SELECTION' && selectedIds.size === 0) {
      setError('Sélectionnez au moins un copieur');
      return;
    }
    setSaving(true);
    try {
      const c = await api.campaigns.create({
        mois,
        dateReleve,
        portee,
        imprimanteIds: portee === 'SELECTION' ? [...selectedIds] : undefined,
      });
      setOpen(false);
      router.push(`/campagnes/${c.mois}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeCampagne(c: Campagne) {
    if (
      !(await confirm({
        title: 'Supprimer la campagne',
        message: `Supprimer la campagne ${c.mois} ? Cette action est irréversible.`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setError(null);
    try {
      await api.campaigns.delete(c.mois);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const sortedRows = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'mois') return row.mois;
        if (key === 'dateReleve') return row.dateReleve;
        if (key === 'lignes') return row._count?.lignes ?? 0;
        if (key === 'portee') return row.portee ?? 'ALL';
        if (key === 'statut') return row.cloturee ? 'Cloturee' : 'Ouverte';
        return '';
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Campagnes</h1>
          <p>Saisie mensuelle sur tout le parc ou une sélection de copieurs</p>
        </div>
        <button
          type="button"
          className="btn btn-esay"
          disabled={!canCreate}
          onClick={() => void openCreateModal()}
        >
          + Ouvrir campagne
        </button>
      </div>

      <PageFeedback error={error} onDismiss={() => setError(null)} />

      <Modal
        open={open}
        wide
        eyebrow="NOUVEAU"
        title="Ouvrir une campagne"
        subtitle="Choisissez le mois, la date de relevé et les copieurs concernés."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="camp-form" disabled={saving}>
              {saving ? 'Ouverture…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="camp-form" className="modal-form" onSubmit={create}>
          <div className="modal-form-row">
            <label>Mois</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="month"
                value={mois}
                onChange={(e) => setMois(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Date relevé</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                value={dateReleve}
                onChange={(e) => setDateReleve(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Portée</label>
            <div className="modal-field">
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 8 }}>
                <input
                  type="radio"
                  name="portee"
                  checked={portee === 'ALL'}
                  onChange={() => setPortee('ALL')}
                />
                Tous les copieurs actifs ({printers.length})
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="radio"
                  name="portee"
                  checked={portee === 'SELECTION'}
                  onChange={() => setPortee('SELECTION')}
                />
                Sélection de copieurs
              </label>
            </div>
          </div>
          {portee === 'SELECTION' ? (
            <div className="modal-form-row is-top">
              <label>Copieurs</label>
              <div className="modal-field">
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    className="modal-input"
                    placeholder="Rechercher code, localisation…"
                    value={printerQ}
                    onChange={(e) => setPrinterQ(e.target.value)}
                  />
                  <button type="button" className="btn btn-soft" onClick={selectAllVisible}>
                    Tout cocher
                  </button>
                  <button type="button" className="btn btn-soft" onClick={clearSelection}>
                    Tout décocher
                  </button>
                </div>
                <p className="muted" style={{ marginBottom: '0.5rem' }}>
                  {selectedIds.size} copieur(s) sélectionné(s)
                </p>
                <div className="camp-printer-pick">
                  {filteredPrinters.map((p) => (
                    <label key={p.id} className="camp-printer-pick-row">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => togglePrinter(p.id)}
                      />
                      <span className="mono">{p.code}</span>
                      <span>{p.localisation ?? '—'}</span>
                      <span className="muted">{p.modele}</span>
                    </label>
                  ))}
                  {filteredPrinters.length === 0 ? (
                    <p className="muted">Aucun copieur trouvé</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>

      <DataTableShell loading={loading} empty={!loading && rows.length === 0} emptyMessage="Aucune campagne">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Mois" sortKey="mois" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Date releve" sortKey="dateReleve" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Portée" sortKey="portee" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Lignes" sortKey="lignes" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              {canDelete ? <th className="col-actions">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campagnes/${c.mois}`} className="mono">{c.mois}</Link>
                </td>
                <td>{formatDate(c.dateReleve)}</td>
                <td>
                  {c.portee === 'SELECTION' ? (
                    <span className="badge badge-info">Sélection ({c._count?.lignes ?? 0})</span>
                  ) : (
                    <span className="badge badge-muted">Tous</span>
                  )}
                </td>
                <td data-align="right">{c._count?.lignes ?? '—'}</td>
                <td>
                  <span className={c.cloturee ? 'badge badge-muted' : 'badge badge-ok'}>
                    {c.cloturee ? 'Cloturee' : 'Ouverte'}
                  </span>
                </td>
                {canDelete ? (
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      disabled={c.cloturee}
                      title={c.cloturee ? 'Campagne clôturée' : 'Supprimer'}
                      onClick={() => void removeCampagne(c)}
                    >
                      Supprimer
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
