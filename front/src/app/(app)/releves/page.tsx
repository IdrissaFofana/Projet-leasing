'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useRouter } from 'next/navigation';
import { FileDropzone } from '@/components/FileDropzone';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { currentMois, formatDate } from '@/lib/format';
import type {
  ControlView,
  Imprimante,
  MonthlyView,
  NamedRef,
  ObservationReleve,
  PreviousReading,
  ReadingsMatrix,
  Releve,
} from '@/lib/types';
import { OBSERVATION_RELEVE_LABEL } from '@/lib/types';

type Tab = 'liste' | 'mensuelle' | 'controle' | 'matrice';

const COUNTER_STEPS = [
  { key: 'c112', label: '112 — Noir grand' },
  { key: 'c113', label: '113 — Noir petit' },
  { key: 'c122', label: '122 — Couleur grand' },
  { key: 'c123', label: '123 — Couleur petit' },
  { key: 'c301', label: '301 — Contrôle noir' },
  { key: 'c501', label: '501 — Total lecture' },
  { key: 'scanNoir', label: 'Scan noir' },
  { key: 'scanCouleur', label: 'Scan couleur' },
  { key: 'envoi', label: 'Envoi' },
] as const;

function statutBadge(statut: string) {
  if (statut === 'OK' || statut === 'VALIDE') return 'badge badge-ok';
  if (statut === 'BASE_INITIALE' || statut === 'CONTROLE') return 'badge badge-info';
  if (statut === 'ANOMALIE_COMPTEUR') return 'badge badge-danger';
  if (statut === 'A_CONTROLER' || statut === 'BROUILLON') return 'badge badge-warn';
  return 'badge badge-muted';
}

const emptyForm = () => ({
  imprimanteId: '',
  moisFacture: currentMois(),
  dateReleve: new Date().toISOString().slice(0, 10),
  c112: '',
  c113: '',
  c122: '',
  c123: '',
  c301: '',
  c501: '',
  scanNoir: '',
  scanCouleur: '',
  envoi: '',
  observationMotif: '' as '' | ObservationReleve,
  observations: '',
});

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h === name || h.includes(name));
  const codeIdx = idx('code');
  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim());
    const num = (i: number) => {
      if (i < 0 || !cols[i]) return undefined;
      const n = Number(cols[i]);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      codeImprimante: cols[codeIdx >= 0 ? codeIdx : 0] ?? '',
      c112: num(idx('c112') >= 0 ? idx('c112') : 1),
      c113: num(idx('c113') >= 0 ? idx('c113') : 2),
      c122: num(idx('c122') >= 0 ? idx('c122') : 3),
      c123: num(idx('c123') >= 0 ? idx('c123') : 4),
      c301: num(idx('c301')),
      c501: num(idx('c501')),
      scanNoir: num(idx('scan')),
      scanCouleur: num(idx('scancouleur') >= 0 ? idx('scancouleur') : idx('scan_couleur')),
      envoi: num(idx('envoi')),
    };
  });
}

export default function RelevesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('liste');
  const [mois, setMois] = useState(currentMois());
  const [rows, setRows] = useState<Releve[]>([]);
  const [monthly, setMonthly] = useState<MonthlyView | null>(null);
  const [control, setControl] = useState<ControlView | null>(null);
  const [matrix, setMatrix] = useState<ReadingsMatrix | null>(null);
  const [moisDebut, setMoisDebut] = useState(() => {
    const [y, m] = currentMois().split('-').map(Number);
    const d = new Date(y, m - 4, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [moisFin, setMoisFin] = useState(currentMois());
  const [matrixMetric, setMatrixMetric] = useState<'compteurs' | 'delta' | 'facturer'>('compteurs');
  const [printers, setPrinters] = useState<Imprimante[]>([]);
  const [services, setServices] = useState<NamedRef[]>([]);
  const [marques, setMarques] = useState<NamedRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rapportFile, setRapportFile] = useState<File | null>(null);
  const [previous, setPrevious] = useState<PreviousReading>(null);
  const [q, setQ] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [marqueId, setMarqueId] = useState('');
  const [localisation, setLocalisation] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [acceptMotif, setAcceptMotif] = useState<ObservationReleve>('RESET_COMPTEUR');
  const [acceptNote, setAcceptNote] = useState('');
  const listeSort = useTableSort<Releve>('localisation');
  const mensuelleSort = useTableSort<MonthlyView['lignes'][number]>('imprimante');
  const controleSort = useTableSort<ControlView['lignes'][number]>('code');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'liste') {
        setRows(
          await api.readings.list({
            mois,
            q: q || undefined,
            serviceId: serviceId || undefined,
            marqueId: marqueId || undefined,
            localisation: localisation || undefined,
            file: fileFilter || undefined,
          }),
        );
      } else if (tab === 'mensuelle') setMonthly(await api.readings.monthlyView(mois));
      else if (tab === 'matrice') setMatrix(await api.readings.matrix(moisDebut, moisFin));
      else setControl(await api.readings.control(mois));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mois, moisDebut, moisFin, q, serviceId, marqueId, localisation, fileFilter]);

  useEffect(() => {
    api.printers
      .list()
      .then((list) => setPrinters(list.filter((p) => p.statut !== 'RETIREE')))
      .catch(() => undefined);
    api.services.list().then(setServices).catch(() => undefined);
    api.marques.list().then(setMarques).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!form.imprimanteId || !form.moisFacture) {
      setPrevious(null);
      return;
    }
    api.readings
      .previous({
        imprimanteId: form.imprimanteId,
        moisFacture: form.moisFacture,
        dateReleve: form.dateReleve || undefined,
      })
      .then(setPrevious)
      .catch(() => setPrevious(null));
  }, [form.imprimanteId, form.moisFacture, form.dateReleve]);

  function openModal() {
    setForm(emptyForm());
    setRapportFile(null);
    setFormError(null);
    setPrevious(null);
    setOpen(true);
  }

  function setField(key: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onCreate(e: FormEvent, brouillon = false) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.readings.create({
        imprimanteId: form.imprimanteId,
        moisFacture: form.moisFacture,
        dateReleve: form.dateReleve,
        c112: Number(form.c112 || 0),
        c113: Number(form.c113 || 0),
        c122: Number(form.c122 || 0),
        c123: Number(form.c123 || 0),
        c301: form.c301 === '' ? undefined : Number(form.c301),
        c501: form.c501 === '' ? undefined : Number(form.c501),
        scanNoir: Number(form.scanNoir || 0),
        scanCouleur: Number(form.scanCouleur || 0),
        envoi: Number(form.envoi || 0),
        observationMotif: form.observationMotif || undefined,
        observations: form.observations || undefined,
        brouillon,
      });
      if (rapportFile) {
        await api.readings.uploadRapport(created.id, rapportFile);
      }
      setOpen(false);
      router.push(`/releves/${created.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setImportMsg(null);
    try {
      const rowsCsv = parseCsv(importText);
      if (rowsCsv.length === 0) throw new Error('CSV vide ou invalide');
      const res = await api.readings.import({
        moisFacture: mois,
        dateReleve: new Date().toISOString().slice(0, 10),
        rows: rowsCsv,
      });
      setImportMsg(`Import : ${res.ok}/${res.total} OK, ${res.erreurs} erreur(s)`);
      setImportOpen(false);
      await load();
    } catch (err) {
      setImportMsg(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(format: 'xlsx' | 'pdf') {
    setError(null);
    try {
      const view =
        tab === 'liste'
          ? 'liste'
          : tab === 'mensuelle'
            ? 'mensuelle'
            : tab === 'matrice'
              ? 'matrice'
              : 'controle';
      await api.readings.exportFile({
        format,
        view,
        mois,
        moisDebut: tab === 'matrice' ? moisDebut : undefined,
        moisFin: tab === 'matrice' ? moisFin : undefined,
        metric: tab === 'matrice' ? matrixMetric : undefined,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }

  async function exportControl() {
    try {
      const res = await api.readings.controlExport(mois);
      const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }

  async function runAccept() {
    if (!acceptId) return;
    setSaving(true);
    try {
      await api.readings.acceptAnomaly(acceptId, {
        observationMotif: acceptMotif,
        observations: acceptNote || undefined,
      });
      setAcceptId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    } finally {
      setSaving(false);
    }
  }

  const sortedRows = useMemo(
    () =>
      listeSort.sort(rows, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'imprimante') return row.imprimante?.code ?? '';
        if (key === 'localisation') return row.imprimante?.localisation ?? '';
        if (key === 'dateReleve') return row.dateReleve;
        if (key === 'totalNoir') return row.totalNoir;
        if (key === 'totalCouleur') return row.totalCouleur;
        if (key === 'deltaN') return row.copiesNoirFacturer;
        if (key === 'deltaC') return row.copiesCouleurFacturer;
        if (key === 'ecart') return row.ecartControle ?? -1;
        if (key === 'statut') return row.statut;
        return '';
      }),
    [rows, listeSort],
  );

  const tourGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.imprimante?.localisation?.trim() || 'Sans localisation';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const sortedMensuelle = useMemo(
    () =>
      monthly
        ? mensuelleSort.sort(monthly.lignes, (row, key) => {
            if (key === 'imprimante') return row.imprimante.code;
            if (key === 'debutN') return row.debut?.totalNoir ?? -1;
            if (key === 'finN') return row.fin.totalNoir;
            if (key === 'deltaN') return row.delta.noir;
            if (key === 'debutC') return row.debut?.totalCouleur ?? -1;
            if (key === 'finC') return row.fin.totalCouleur;
            if (key === 'deltaC') return row.delta.couleur;
            if (key === 'pctN') return row.comparaison?.pctNoir ?? -999;
            if (key === 'statut') return row.fin.statut;
            return '';
          })
        : [],
    [monthly, mensuelleSort],
  );

  const controleRows = control?.file?.length ? control.file : control?.lignes ?? [];
  const sortedControle = useMemo(
    () =>
      controleSort.sort(controleRows, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'imprimante') return row.imprimante.code;
        if (key === 'totalNoir') return row.totalNoir;
        if (key === 'c301') return row.c301 ?? -1;
        if (key === 'ecart') return row.ecartControle ?? -1;
        if (key === 'statut') return row.statut;
        return '';
      }),
    [controleRows, controleSort],
  );

  const printersSorted = useMemo(
    () =>
      [...printers].sort((a, b) =>
        (a.localisation ?? '').localeCompare(b.localisation ?? '') || a.code.localeCompare(b.code),
      ),
    [printers],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Relevés</h1>
          <p>Prélèvement, différences, contrôle et validation</p>
        </div>
        <div className="actions-inline">
          <button type="button" className="btn btn-soft" onClick={() => setImportOpen(true)}>
            Import CSV
          </button>
          <Link href="/campagnes" className="btn btn-soft">
            Campagne mensuelle
          </Link>
          <button type="button" className="btn btn-esay" onClick={openModal}>
            + Nouveau relevé
          </button>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ['liste', 'Liste / tournée'],
            ['mensuelle', 'Vue mensuelle'],
            ['matrice', 'Matrice parc'],
            ['controle', 'Contrôle'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        {tab === 'matrice' ? (
          <>
            <input className="input" type="month" value={moisDebut} onChange={(e) => setMoisDebut(e.target.value)} />
            <span>→</span>
            <input className="input" type="month" value={moisFin} onChange={(e) => setMoisFin(e.target.value)} />
            <select
              className="select"
              value={matrixMetric}
              onChange={(e) => setMatrixMetric(e.target.value as typeof matrixMetric)}
            >
              <option value="compteurs">Compteurs (N / C)</option>
              <option value="delta">Consommation Δ</option>
              <option value="facturer">À facturer (après quota)</option>
            </select>
          </>
        ) : (
          <input className="input" type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        )}
        {tab === 'liste' ? (
          <>
            <input
              className="input"
              placeholder="Code, série, modèle…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="select" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Tous services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
            <select className="select" value={marqueId} onChange={(e) => setMarqueId(e.target.value)}>
              <option value="">Toutes marques</option>
              {marques.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Localisation / tournée"
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
            />
            <select className="select" value={fileFilter} onChange={(e) => setFileFilter(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="anomalie">Anomalies</option>
              <option value="controle">À contrôler</option>
              <option value="ok">OK / validés</option>
            </select>
          </>
        ) : null}
        {tab === 'controle' ? (
          <button type="button" className="btn btn-soft" onClick={() => void exportControl()}>
            Export CSV
          </button>
        ) : null}
        <button type="button" className="btn btn-soft" onClick={() => void exportFile('xlsx')}>
          Export Excel
        </button>
        <button type="button" className="btn btn-esay" onClick={() => void exportFile('pdf')}>
          Export PDF
        </button>
        <button type="button" className="btn btn-soft" onClick={() => void load()}>
          Actualiser
        </button>
      </div>

      <PageFeedback
        error={error ?? formError}
        ok={importMsg}
        onDismiss={() => {
          setError(null);
          setFormError(null);
          setImportMsg(null);
        }}
      />

      <Modal
        open={open}
        eyebrow="PRÉLÈVEMENT"
        title="Nouveau relevé"
        subtitle="Saisie guidée avec anciens compteurs affichés."
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="releve-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="releve-form" className="modal-form" onSubmit={(e) => void onCreate(e, false)}>
          <div className="modal-form-row">
            <label>Copieur</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={form.imprimanteId}
                onChange={(e) => setField('imprimanteId', e.target.value)}
              >
                <option value="">Choisir (tri tournée)…</option>
                {printersSorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.localisation ?? p.modele}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Mois facture</label>
            <div className="modal-field">
              <input className="modal-input" type="month" required value={form.moisFacture} onChange={(e) => setField('moisFacture', e.target.value)} />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Date relevé</label>
            <div className="modal-field">
              <input className="modal-input" type="date" required value={form.dateReleve} onChange={(e) => setField('dateReleve', e.target.value)} />
            </div>
          </div>

          {previous ? (
            <div className="panel" style={{ marginBottom: '0.85rem', padding: '0.85rem' }}>
              <h2 style={{ marginBottom: '0.35rem' }}>Ancien relevé {previous.code}</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
                {previous.moisFacture} · N {previous.totalNoir} · C {previous.totalCouleur} · ΔN {previous.copiesNoirFacturer}
              </p>
            </div>
          ) : form.imprimanteId ? (
            <p className="empty-state" style={{ padding: '0.5rem 0' }}>Premier relevé (base initiale)</p>
          ) : null}

          {COUNTER_STEPS.map((step) => (
            <div className="modal-form-row" key={step.key}>
              <label>{step.label}</label>
              <div className="modal-field">
                <input
                  className="modal-input"
                  type="number"
                  min={0}
                  placeholder={
                    previous && step.key in previous
                      ? `Ancien: ${String((previous as Record<string, unknown>)[step.key] ?? '—')}`
                      : undefined
                  }
                  value={form[step.key]}
                  onChange={(e) => setField(step.key, e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="modal-form-row">
            <label>Motif</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.observationMotif}
                onChange={(e) => setField('observationMotif', e.target.value)}
              >
                <option value="">—</option>
                {(Object.keys(OBSERVATION_RELEVE_LABEL) as ObservationReleve[]).map((k) => (
                  <option key={k} value={k}>{OBSERVATION_RELEVE_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Observations</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                value={form.observations}
                onChange={(e) => setField('observations', e.target.value)}
              />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Rapport compteur</label>
            <div className="modal-field">
              <FileDropzone file={rapportFile} onFile={setRapportFile} />
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                Une assistance est créée automatiquement à l’enregistrement.
              </p>
            </div>
          </div>
          <div className="actions-inline" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-soft"
              disabled={saving}
              onClick={(e) => void onCreate(e as unknown as FormEvent, true)}
            >
              Enregistrer brouillon
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importOpen}
        eyebrow="IMPORT"
        title="Import CSV relevés"
        subtitle="Colonnes : code;c112;c113;c122;c123;c301;…"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setImportOpen(false)} label="Annuler" />
            <ModalSubmitButton form="import-form" disabled={saving}>
              {saving ? 'Import…' : 'Importer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="import-form" className="modal-form" onSubmit={(e) => void onImport(e)}>
          <div className="modal-form-row is-top">
            <label>CSV</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                rows={10}
                placeholder={'code;c112;c113;c122;c123;c301\nIMP-0001;1200;600;250;150;1800'}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!acceptId}
        eyebrow="ANOMALIE"
        title="Accepter avec motif"
        subtitle="Justifie une baisse de compteur (reset, remplacement…)."
        onClose={() => setAcceptId(null)}
        footer={
          <>
            <ModalCloseButton onClick={() => setAcceptId(null)} label="Annuler" />
            <ModalSubmitButton form="accept-form" disabled={saving}>
              Valider le motif
            </ModalSubmitButton>
          </>
        }
      >
        <form
          id="accept-form"
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            void runAccept();
          }}
        >
          <div className="modal-form-row">
            <label>Motif</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={acceptMotif}
                onChange={(e) => setAcceptMotif(e.target.value as ObservationReleve)}
              >
                {(Object.keys(OBSERVATION_RELEVE_LABEL) as ObservationReleve[])
                  .filter((k) => k !== 'RAS')
                  .map((k) => (
                    <option key={k} value={k}>{OBSERVATION_RELEVE_LABEL[k]}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Note</label>
            <div className="modal-field">
              <textarea className="modal-textarea" value={acceptNote} onChange={(e) => setAcceptNote(e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>

      {loading ? <p className="empty-state">Chargement…</p> : null}

      {!loading && tab === 'liste' ? (
        <>
          {tourGroups.length > 0 ? (
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <h2>Tournées ({tourGroups.length})</h2>
              <p style={{ margin: 0 }}>
                {tourGroups.map(([loc, n]) => (
                  <button
                    key={loc}
                    type="button"
                    className="btn btn-soft btn-sm"
                    style={{ margin: '0.2rem' }}
                    onClick={() => setLocalisation(loc === 'Sans localisation' ? '' : loc)}
                  >
                    {loc} ({n})
                  </button>
                ))}
              </p>
            </div>
          ) : null}
          <DataTableShell empty={rows.length === 0} emptyMessage={`Aucun relevé pour ${mois}`}>
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh label="Code" sortKey="code" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} />
                  <SortTh label="Copieur" sortKey="imprimante" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} />
                  <SortTh label="Localisation" sortKey="localisation" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} />
                  <SortTh label="ΔN" sortKey="deltaN" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} align="right" />
                  <SortTh label="Inclus N" sortKey="deltaN" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} align="right" />
                  <SortTh label="Fact. N" sortKey="deltaN" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} align="right" />
                  <SortTh label="Fact. C" sortKey="deltaC" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} align="right" />
                  <SortTh label="Report N" sortKey="ecart" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} align="right" />
                  <SortTh label="Statut" sortKey="statut" activeKey={listeSort.sortKey} direction={listeSort.sortDir} onSort={listeSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/releves/${r.id}`} className="mono">{r.code}</Link></td>
                    <td>{r.imprimante?.code ?? '—'}</td>
                    <td>{r.imprimante?.localisation ?? '—'}</td>
                    <td data-align="right">{r.copiesNoirDelta ?? '—'}</td>
                    <td data-align="right">{r.copiesNoirIncluses ?? '—'}</td>
                    <td data-align="right">{r.copiesNoirFacturer}</td>
                    <td data-align="right">{r.copiesCouleurFacturer}</td>
                    <td data-align="right">{r.quotaNoirReport ?? '—'}</td>
                    <td><span className={statutBadge(r.statut)}>{r.statut}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </>
      ) : null}

      {!loading && tab === 'matrice' && matrix ? (
        <>
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h2>Parc × mois</h2>
            <p>
              Quota de base : <strong>{matrix.quotaBase.noir} N</strong> +{' '}
              <strong>{matrix.quotaBase.couleur} C</strong> / mois (report du reliquat). Affichage :{' '}
              {matrixMetric === 'compteurs'
                ? 'totaux compteurs'
                : matrixMetric === 'delta'
                  ? 'consommation du mois'
                  : 'copies facturables après quota'}
              .
            </p>
          </div>
          <DataTableShell empty={matrix.lignes.length === 0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Copieur</th>
                  <th>Localisation</th>
                  {matrix.mois.map((m) => (
                    <th key={m} data-align="center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.lignes.map((l) => (
                  <tr key={l.imprimante.id}>
                    <td className="mono">{l.imprimante.code}</td>
                    <td>{l.imprimante.localisation ?? '—'}</td>
                    {matrix.mois.map((m) => {
                      const c = l.cellules[m];
                      if (!c) {
                        return (
                          <td key={m} data-align="center" className="empty-state" style={{ padding: '0.5rem' }}>
                            —
                          </td>
                        );
                      }
                      let label = `${c.totalNoir} / ${c.totalCouleur}`;
                      if (matrixMetric === 'delta') label = `Δ ${c.deltaNoir} / ${c.deltaCouleur}`;
                      if (matrixMetric === 'facturer') label = `F ${c.facturerNoir} / ${c.facturerCouleur}`;
                      return (
                        <td key={m} data-align="center">
                          <Link href={`/releves/${c.id}`} title={c.code}>
                            {label}
                          </Link>
                          <div>
                            <span className={statutBadge(c.statut)} style={{ fontSize: '0.65rem' }}>
                              {c.statut === 'BASE_INITIALE' ? 'BASE' : c.statut.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </>
      ) : null}

      {!loading && tab === 'mensuelle' && monthly ? (
        <>
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h2>Totaux {monthly.mois}</h2>
            <p>
              Δ noir <strong>{monthly.totaux.deltaNoir}</strong> · Δ couleur{' '}
              <strong>{monthly.totaux.deltaCouleur}</strong> · total{' '}
              <strong>{monthly.totaux.deltaTotal}</strong> · {monthly.totaux.nbImprimantes} machine(s)
              {monthly.moisPrecedent ? ` · vs ${monthly.moisPrecedent}` : ''}
            </p>
          </div>
          <DataTableShell empty={sortedMensuelle.length === 0}>
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh label="Copieur" sortKey="imprimante" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} />
                  <SortTh label="Début N" sortKey="debutN" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} align="right" />
                  <SortTh label="Fin N" sortKey="finN" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} align="right" />
                  <SortTh label="ΔN" sortKey="deltaN" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} align="right" />
                  <SortTh label="% vs M-1" sortKey="pctN" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} align="right" />
                  <SortTh label="ΔC" sortKey="deltaC" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} align="right" />
                  <SortTh label="Statut" sortKey="statut" activeKey={mensuelleSort.sortKey} direction={mensuelleSort.sortDir} onSort={mensuelleSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedMensuelle.map((l) => (
                  <tr key={l.fin.code}>
                    <td className="mono">{l.imprimante.code}</td>
                    <td data-align="right">{l.debut?.totalNoir ?? '—'}</td>
                    <td data-align="right">{l.fin.totalNoir}</td>
                    <td data-align="right">
                      {l.delta.noir}
                      {l.delta.noirBrut != null && l.delta.noirBrut !== l.delta.noir ? (
                        <span className="badge badge-muted" style={{ marginLeft: 4 }}>brut {l.delta.noirBrut}</span>
                      ) : null}
                    </td>
                    <td data-align="right">
                      {l.comparaison?.pctNoir != null ? `${l.comparaison.pctNoir}%` : '—'}
                    </td>
                    <td data-align="right">{l.delta.couleur}</td>
                    <td><span className={statutBadge(l.fin.statut)}>{l.fin.statut}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </>
      ) : null}

      {!loading && tab === 'controle' && control ? (
        <>
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h2>File de contrôle</h2>
            <p>
              {control.resume.total} relevé(s) · {control.resume.aTraiter ?? 0} à traiter ·{' '}
              {control.resume.anomalies} anomalie(s) · {control.resume.ecartsNonNuls} écart(s) 301 ·{' '}
              {control.resume.alertesDelta ?? 0} Δ haut · {control.resume.valides ?? 0} validé(s)
            </p>
          </div>
          <DataTableShell empty={sortedControle.length === 0} emptyMessage="Rien à contrôler">
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh label="Code" sortKey="code" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} />
                  <SortTh label="Copieur" sortKey="imprimante" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} />
                  <SortTh label="ΔN brut/fact." sortKey="totalNoir" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} align="right" />
                  <SortTh label="301" sortKey="c301" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} align="right" />
                  <SortTh label="Écart" sortKey="ecart" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} align="right" />
                  <SortTh label="Statut" sortKey="statut" activeKey={controleSort.sortKey} direction={controleSort.sortDir} onSort={controleSort.toggle} />
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedControle.map((l) => (
                  <tr key={l.id} className={l.aTraiter ? 'is-selected' : undefined}>
                    <td><Link href={`/releves/${l.id}`} className="mono">{l.code}</Link></td>
                    <td>{l.imprimante.code}</td>
                    <td data-align="right">
                      {l.copiesNoirBrutes ?? '—'}/{l.copiesNoirFacturer ?? '—'}
                    </td>
                    <td data-align="right">{l.c301 ?? '—'}</td>
                    <td data-align="right">
                      <span className={l.ecartOk ? 'badge badge-ok' : 'badge badge-danger'}>
                        {l.ecartControle ?? '—'}
                      </span>
                    </td>
                    <td><span className={statutBadge(l.statut)}>{l.statut}</span></td>
                    <td className="col-actions">
                      <div className="tbl-actions">
                        {l.anomaly ? (
                          <button type="button" className="btn btn-soft btn-sm" onClick={() => setAcceptId(l.id)}>
                            Motif
                          </button>
                        ) : null}
                        {l.statut === 'OK' || l.statut === 'A_CONTROLER' || l.statut === 'BASE_INITIALE' ? (
                          <button
                            type="button"
                            className="btn btn-soft btn-sm"
                            onClick={() => void api.readings.markControle(l.id).then(load)}
                          >
                            Contrôler
                          </button>
                        ) : null}
                        {l.statut === 'CONTROLE' || l.statut === 'OK' || l.statut === 'BASE_INITIALE' ? (
                          <button
                            type="button"
                            className="btn btn-esay btn-sm"
                            onClick={() => void api.readings.markValide(l.id).then(load)}
                          >
                            Valider
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </>
      ) : null}
    </>
  );
}
