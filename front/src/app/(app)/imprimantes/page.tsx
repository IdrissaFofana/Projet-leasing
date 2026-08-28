'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DataTableShell,
  SortTh,
  TableActions,
  useTableSort,
} from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { ImprimanteDetailModal } from '@/components/imprimantes/ImprimanteDetailModal';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  STATUT_IMP_LABEL,
  type Imprimante,
  type NamedRef,
  type StatutImprimante,
} from '@/lib/types';

function statutBadge(statut: StatutImprimante) {
  if (statut === 'FONCTIONNELLE') return 'badge badge-ok';
  if (statut === 'EN_MAINTENANCE') return 'badge badge-warn';
  if (statut === 'HORS_SERVICE') return 'badge badge-danger';
  return 'badge badge-muted';
}

const emptyForm = {
  modele: 'IR-ADV C930',
  numeroSerie: '',
  marqueId: '',
  fournisseurId: '',
  serviceId: '',
  localisation: '',
  statut: 'FONCTIONNELLE' as StatutImprimante,
  dateInstallation: '',
  observations: '',
};

function ImprimantesPageContent() {
  const { confirm } = useFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Imprimante[]>([]);
  const [marques, setMarques] = useState<NamedRef[]>([]);
  const [fournisseurs, setFournisseurs] = useState<NamedRef[]>([]);
  const [services, setServices] = useState<NamedRef[]>([]);
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('');
  const [marqueId, setMarqueId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const { sortKey, sortDir, toggle, sort } = useTableSort<Imprimante>('code');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, m, f, s] = await Promise.all([
        api.printers.list({
          q: q || undefined,
          statut: (statut as StatutImprimante) || undefined,
          marqueId: marqueId || undefined,
        }),
        api.marques.list(),
        api.fournisseurs.list(),
        api.services.list(),
      ]);
      setRows(list);
      setMarques(m);
      setFournisseurs(f);
      setServices(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setDetailId(id);
      setDetailMode('view');
    }
  }, [searchParams]);

  function openDetail(row: Imprimante, mode: 'view' | 'edit' = 'view') {
    setDetailId(row.id);
    setDetailMode(mode);
    router.replace(`/imprimantes?id=${row.id}`, { scroll: false });
  }

  function closeDetail() {
    setDetailId(null);
    router.replace('/imprimantes', { scroll: false });
  }

  function openModal() {
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.printers.create({
        modele: form.modele,
        numeroSerie: form.numeroSerie,
        marqueId: form.marqueId || undefined,
        fournisseurId: form.fournisseurId || undefined,
        serviceId: form.serviceId || undefined,
        localisation: form.localisation || undefined,
        statut: form.statut,
        dateInstallation: form.dateInstallation || undefined,
        observations: form.observations || undefined,
      });
      setOpen(false);
      setOk('Copieur créé');
      await load();
      openDetail(created);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: Imprimante) {
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Retirer ${row.code} du parc ?`,
        danger: true,
        confirmLabel: 'Retirer',
      }))
    )
      return;
    setError(null);
    try {
      await api.printers.remove(row.id);
      if (detailId === row.id) closeDetail();
      setOk(`${row.code} retirée du parc`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const sortedRows = useMemo(
    () =>
      sort(rows, (row, key) => {
        switch (key) {
          case 'code':
            return row.code;
          case 'modele':
            return row.modele;
          case 'numeroSerie':
            return row.numeroSerie;
          case 'marque':
            return row.marque?.nom ?? '';
          case 'localisation':
            return row.localisation ?? '';
          case 'statut':
            return STATUT_IMP_LABEL[row.statut];
          case 'dateInstallation':
            return row.dateInstallation ?? '';
          default:
            return '';
        }
      }),
    [rows, sort],
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      actives: rows.filter((r) => r.statut !== 'RETIREE').length,
    }),
    [rows],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Copieurs</h1>
          <p>{counts.actives} active(s) · {counts.total} au total</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openModal}>
          + Nouveau copieur
        </button>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Rechercher code, série, modèle…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select className="select" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_IMP_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="select" value={marqueId} onChange={(e) => setMarqueId(e.target.value)}>
          <option value="">Toutes marques</option>
          {marques.map((m) => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
        <button type="button" className="btn btn-soft" onClick={() => void load()}>Filtrer</button>
      </div>

      <PageFeedback
        error={error ?? formError}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setFormError(null);
          setOk(null);
        }}
      />

      <Modal
        open={open}
        eyebrow="NOUVEAU"
        title="Nouveau copieur"
        subtitle="Saisissez le modèle, le n° de série et la localisation."
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="imprimante-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="imprimante-form" className="modal-form" onSubmit={onCreate}>
          <div className="modal-form-row">
            <label>Modèle</label>
            <div className="modal-field">
              <input className="modal-input" value={form.modele} onChange={(e) => setField('modele', e.target.value)} required />
            </div>
          </div>
          <div className="modal-form-row">
            <label>N° série</label>
            <div className="modal-field">
              <input className="modal-input" value={form.numeroSerie} onChange={(e) => setField('numeroSerie', e.target.value)} required />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Marque</label>
            <div className="modal-field">
              <select className="modal-select" value={form.marqueId} onChange={(e) => setField('marqueId', e.target.value)}>
                <option value="">—</option>
                {marques.map((m) => (<option key={m.id} value={m.id}>{m.nom}</option>))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Fournisseur</label>
            <div className="modal-field">
              <select className="modal-select" value={form.fournisseurId} onChange={(e) => setField('fournisseurId', e.target.value)}>
                <option value="">—</option>
                {fournisseurs.map((f) => (<option key={f.id} value={f.id}>{f.nom}</option>))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Service</label>
            <div className="modal-field">
              <select className="modal-select" value={form.serviceId} onChange={(e) => setField('serviceId', e.target.value)}>
                <option value="">—</option>
                {services.map((s) => (<option key={s.id} value={s.id}>{s.nom}</option>))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Statut</label>
            <div className="modal-field">
              <select className="modal-select" value={form.statut} onChange={(e) => setField('statut', e.target.value as StatutImprimante)}>
                {Object.entries(STATUT_IMP_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Localisation</label>
            <div className="modal-field">
              <input className="modal-input" value={form.localisation} onChange={(e) => setField('localisation', e.target.value)} />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Date installation</label>
            <div className="modal-field">
              <input className="modal-input" type="date" value={form.dateInstallation} onChange={(e) => setField('dateInstallation', e.target.value)} />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Observations</label>
            <div className="modal-field">
              <textarea className="modal-textarea" value={form.observations} onChange={(e) => setField('observations', e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>

      <ImprimanteDetailModal
        printerId={detailId}
        initialMode={detailMode}
        marques={marques}
        fournisseurs={fournisseurs}
        services={services}
        onClose={closeDetail}
        onUpdated={(p) => {
          setOk(`${p.code} mise à jour`);
          void load();
        }}
        onDeleted={() => {
          setOk('Copieur retiré du parc');
          void load();
        }}
      />

      <DataTableShell loading={loading} empty={!loading && rows.length === 0} emptyMessage="Aucun copieur">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Code" sortKey="code" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Modèle" sortKey="modele" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="N° série" sortKey="numeroSerie" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Marque" sortKey="marque" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Installation" sortKey="dateInstallation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id} className={detailId === r.id ? 'is-selected' : undefined}>
                <td>
                  <button type="button" className="link-btn mono" onClick={() => openDetail(r)}>
                    {r.code}
                  </button>
                </td>
                <td>{r.modele}</td>
                <td className="mono">{r.numeroSerie}</td>
                <td>{r.marque?.nom ?? '—'}</td>
                <td>{r.localisation ?? '—'}</td>
                <td><span className={statutBadge(r.statut)}>{STATUT_IMP_LABEL[r.statut]}</span></td>
                <td>{formatDate(r.dateInstallation)}</td>
                <td className="col-actions">
                  <TableActions
                    onView={() => openDetail(r)}
                    onEdit={() => openDetail(r, 'edit')}
                    onDelete={() => void onDelete(r)}
                    deleteLabel="Retirer du parc"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}

export default function ImprimantesPage() {
  return (
    <Suspense fallback={<div className="page-head"><h1>Copieurs</h1><p>Chargement…</p></div>}>
      <ImprimantesPageContent />
    </Suspense>
  );
}
