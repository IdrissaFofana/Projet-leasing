'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { FileDropzone } from '@/components/FileDropzone';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Imprimante, Maintenance, NamedRef, UserAssignee } from '@/lib/types';

const TYPES = [
  'ASSISTANCE',
  'PREVENTIVE',
  'CORRECTIVE',
  'DEPANNAGE',
  'NETTOYAGE',
  'REMPLACEMENT_PIECE',
  'CONTROLE_PERIODIQUE',
] as const;

const emptyForm = () => ({
  dateMaintenance: new Date().toISOString().slice(0, 10),
  imprimanteId: '',
  type: 'ASSISTANCE',
  technicienId: '',
  assigneeUserId: '',
  actionsRealisees: '',
  prochaineMaintenance: '',
});

export default function MaintenanceInterventionsPage() {
  const [rows, setRows] = useState<Maintenance[]>([]);
  const [printers, setPrinters] = useState<Imprimante[]>([]);
  const [agents, setAgents] = useState<NamedRef[]>([]);
  const [assignees, setAssignees] = useState<UserAssignee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [rapportFile, setRapportFile] = useState<File | null>(null);
  const { sortKey, sortDir, toggle, sort } = useTableSort<Maintenance>('dateMaintenance', 'desc');

  async function load() {
    const [m, p, a, users] = await Promise.all([
      api.maintenance.list(),
      api.printers.list(),
      api.agents.list(),
      api.users.assignees(),
    ]);
    setRows(m);
    const active = p.filter((x) => x.statut !== 'RETIREE');
    setPrinters(active);
    setAgents(a);
    setAssignees(users);
    setForm((f) => ({
      ...f,
      imprimanteId: f.imprimanteId || active[0]?.id || '',
      technicienId: f.technicienId || a[0]?.id || '',
    }));
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  function openModal() {
    setError(null);
    setOk(null);
    setRapportFile(null);
    setForm({
      ...emptyForm(),
      imprimanteId: printers[0]?.id || '',
      technicienId: agents[0]?.id || '',
      assigneeUserId: '',
    });
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const created = await api.maintenance.create({
        dateMaintenance: form.dateMaintenance,
        imprimanteId: form.imprimanteId,
        type: form.type,
        technicienId: form.technicienId || undefined,
        assigneeUserId: form.assigneeUserId || undefined,
        actionsRealisees: form.actionsRealisees || undefined,
        prochaineMaintenance: form.prochaineMaintenance || undefined,
      });
      if (rapportFile) {
        await api.maintenance.uploadRapport(created.id, rapportFile);
      }
      setOk(`${created.code} créée`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  const sortedRows = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'dateMaintenance') return row.dateMaintenance;
        if (key === 'imprimante') return row.imprimante?.code ?? '';
        if (key === 'localisation') return row.imprimante?.localisation ?? '';
        if (key === 'type') return row.type;
        if (key === 'technicien') return row.technicien?.nom ?? '';
        if (key === 'assignee') return row.assigneeUser?.nom ?? '';
        return '';
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Interventions</h1>
          <p>Maintenances et assistances — détail copieur / localisation</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openModal}>
          + Nouvelle intervention
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
        eyebrow="NOUVEAU"
        title="Nouvelle intervention"
        subtitle="Les assistances comptent dans le quota mensuel (3 / copieur)."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="maintenance-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="maintenance-form" className="modal-form" onSubmit={submit}>
          <div className="modal-form-row">
            <label>Date</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                required
                value={form.dateMaintenance}
                onChange={(e) => setForm({ ...form, dateMaintenance: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Type</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Copieur</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={form.imprimanteId}
                onChange={(e) => setForm({ ...form, imprimanteId: e.target.value })}
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.localisation ?? p.modele}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Technicien</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.technicienId}
                onChange={(e) => setForm({ ...form, technicienId: e.target.value })}
              >
                <option value="">—</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Assigné à</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.assigneeUserId}
                onChange={(e) => setForm({ ...form, assigneeUserId: e.target.value })}
              >
                <option value="">— (pas d’assignation)</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} ({u.email})
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                L’utilisateur assigné recevra une notification.
              </p>
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Actions réalisées</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                value={form.actionsRealisees}
                onChange={(e) => setForm({ ...form, actionsRealisees: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Rapport</label>
            <div className="modal-field">
              <FileDropzone file={rapportFile} onFile={setRapportFile} />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Prochaine</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                value={form.prochaineMaintenance}
                onChange={(e) => setForm({ ...form, prochaineMaintenance: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <DataTableShell empty={rows.length === 0} emptyMessage="Aucune intervention">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Code" sortKey="code" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Date" sortKey="dateMaintenance" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Copieur" sortKey="imprimante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Type" sortKey="type" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Technicien" sortKey="technicien" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Assigné" sortKey="assignee" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{formatDate(r.dateMaintenance)}</td>
                <td>{r.imprimante?.code}</td>
                <td>{r.imprimante?.localisation ?? '—'}</td>
                <td>
                  <span className="badge badge-info">{r.type}</span>
                </td>
                <td>{r.technicien?.nom ?? '—'}</td>
                <td>{r.assigneeUser?.nom ?? '—'}</td>
                <td className="col-actions">
                  <Link href={`/maintenance/${r.id}`} className="btn btn-soft">
                    Détail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
