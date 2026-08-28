'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useRouter } from 'next/navigation';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { currentMois, formatDate } from '@/lib/format';
import type { Campagne } from '@/lib/types';

export default function CampagnesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Campagne[]>([]);
  const [mois, setMois] = useState(currentMois());
  const [dateReleve, setDateReleve] = useState(new Date().toISOString().slice(0, 10));
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

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const c = await api.campaigns.create({ mois, dateReleve });
      setOpen(false);
      router.push(`/campagnes/${c.mois}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  const sortedRows = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'mois') return row.mois;
        if (key === 'dateReleve') return row.dateReleve;
        if (key === 'lignes') return row._count?.lignes ?? 0;
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
          <p>Saisie mensuelle puis archivage vers relevés</p>
        </div>
        <button
          type="button"
          className="btn btn-esay"
          onClick={() => {
            setError(null);
            setMois(currentMois());
            setDateReleve(new Date().toISOString().slice(0, 10));
            setOpen(true);
          }}
        >
          + Ouvrir campagne
        </button>
      </div>

      <PageFeedback error={error} onDismiss={() => setError(null)} />

      <Modal
        open={open}
        eyebrow="NOUVEAU"
        title="Ouvrir une campagne"
        subtitle="Définissez le mois et la date de relevé de la campagne."
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
        </form>
      </Modal>

      <DataTableShell loading={loading} empty={!loading && rows.length === 0} emptyMessage="Aucune campagne">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Mois" sortKey="mois" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Date releve" sortKey="dateReleve" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Lignes" sortKey="lignes" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campagnes/${c.mois}`} className="mono">{c.mois}</Link>
                </td>
                <td>{formatDate(c.dateReleve)}</td>
                <td data-align="right">{c._count?.lignes ?? '—'}</td>
                <td>
                  <span className={c.cloturee ? 'badge badge-muted' : 'badge badge-ok'}>
                    {c.cloturee ? 'Cloturee' : 'Ouverte'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
