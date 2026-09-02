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

const TYPE_LABEL: Record<(typeof TYPES)[number], string> = {
  ASSISTANCE: 'Assistance',
  PREVENTIVE: 'Préventive',
  CORRECTIVE: 'Corrective',
  DEPANNAGE: 'Dépannage',
  NETTOYAGE: 'Nettoyage',
  REMPLACEMENT_PIECE: 'Remplacement pièce',
  CONTROLE_PERIODIQUE: 'Contrôle périodique',
};

const emptyForm = () => ({
  dateMaintenance: new Date().toISOString().slice(0, 10),
  imprimanteIds: [] as string[],
  taches: ['ASSISTANCE'] as string[],
  horsQuota: false,
  technicienId: '',
  assigneeUserId: '',
  actionsRealisees: '',
  prochaineMaintenance: '',
});

function copieursLabel(row: Maintenance) {
  const codes =
    row.imprimantes?.map((l) => l.imprimante?.code).filter(Boolean) ??
    (row.imprimante?.code ? [row.imprimante.code] : []);
  return codes.join(', ') || '—';
}

function tachesLabel(row: Maintenance) {
  const list = row.taches?.length ? row.taches : row.type ? [row.type] : [];
  return list.map((t) => TYPE_LABEL[t as keyof typeof TYPE_LABEL] ?? t).join(', ') || '—';
}

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
  const [exportingId, setExportingId] = useState<string | null>(null);
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
      imprimanteIds: f.imprimanteIds.length ? f.imprimanteIds : active[0]?.id ? [active[0].id] : [],
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
      imprimanteIds: printers[0]?.id ? [printers[0].id] : [],
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
        imprimanteIds: form.imprimanteIds,
        taches: form.taches,
        horsQuota: form.taches.includes('ASSISTANCE') ? form.horsQuota : undefined,
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

  async function genererRapport(row: Maintenance) {
    setExportingId(row.id);
    setError(null);
    setOk(null);
    try {
      await api.reports.intervention(row.id, row.code);
      setOk(`Rapport ${row.code} téléchargé`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Génération du rapport impossible');
    } finally {
      setExportingId(null);
    }
  }

  const sortedRows = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'dateMaintenance') return row.dateMaintenance;
        if (key === 'imprimante') return row.imprimante?.code ?? '';
        if (key === 'localisation') return row.imprimante?.localisation ?? '';
        if (key === 'type') return tachesLabel(row);
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
        subtitle="1 assistance incluse par copieur et par mois. Une intervention peut cumuler plusieurs tâches et plusieurs copieurs."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="maintenance-form" disabled={saving || form.imprimanteIds.length === 0 || form.taches.length === 0}>
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
          <div className="modal-form-row is-top">
            <label>Tâches</label>
            <div className="modal-field">
              <div className="checkbox-list">
                {TYPES.map((t) => {
                  const checked = form.taches.includes(t);
                  return (
                    <label key={t} className="checkbox-row" style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            taches: e.target.checked
                              ? [...f.taches, t]
                              : f.taches.filter((x) => x !== t),
                          }));
                        }}
                      />
                      <span>{TYPE_LABEL[t]}</span>
                    </label>
                  );
                })}
              </div>
              {form.taches.length === 0 ? (
                <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  Sélectionnez au moins une tâche.
                </p>
              ) : null}
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Copieurs</label>
            <div className="modal-field">
              <div className="checkbox-list" style={{ maxHeight: 180, overflowY: 'auto' }}>
                {printers.map((p) => {
                  const checked = form.imprimanteIds.includes(p.id);
                  return (
                    <label key={p.id} className="checkbox-row" style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            imprimanteIds: e.target.checked
                              ? [...f.imprimanteIds, p.id]
                              : f.imprimanteIds.filter((id) => id !== p.id),
                          }));
                        }}
                      />
                      <span>{p.code} — {p.localisation ?? p.modele}</span>
                    </label>
                  );
                })}
              </div>
              {form.imprimanteIds.length === 0 ? (
                <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
                  Sélectionnez au moins un copieur.
                </p>
              ) : null}
            </div>
          </div>
          {form.taches.includes('ASSISTANCE') ? (
            <div className="modal-form-row">
              <label>Panne</label>
              <div className="modal-field">
                <label className="checkbox-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.horsQuota}
                    onChange={(e) => setForm({ ...form, horsQuota: e.target.checked })}
                  />
                  <span>Panne signalée (hors quota mensuel)</span>
                </label>
              </div>
            </div>
          ) : null}
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
              <SortTh label="Copieur(s)" sortKey="imprimante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Tâches" sortKey="type" activeKey={sortKey} direction={sortDir} onSort={toggle} />
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
                <td>{copieursLabel(r)}</td>
                <td>{r.imprimante?.localisation ?? r.imprimantes?.[0]?.imprimante?.localisation ?? '—'}</td>
                <td>
                  <span className="badge badge-info">{tachesLabel(r)}</span>
                  {r.horsQuota ? (
                    <span className="badge badge-warn" style={{ marginLeft: 6 }}>Panne</span>
                  ) : r.releveId ? (
                    <span className="badge badge-info" style={{ marginLeft: 6 }}>Prélèvement</span>
                  ) : null}
                </td>
                <td>{r.technicien?.nom ?? '—'}</td>
                <td>{r.assigneeUser?.nom ?? '—'}</td>
                <td className="col-actions">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-esay"
                      disabled={exportingId === r.id}
                      onClick={() => void genererRapport(r)}
                    >
                      {exportingId === r.id ? '…' : 'Générer rapport'}
                    </button>
                    <Link href={`/maintenance/${r.id}`} className="btn btn-soft">
                      Détail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
