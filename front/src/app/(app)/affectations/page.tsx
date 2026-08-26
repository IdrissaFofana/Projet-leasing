'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AffectationDetailModal } from '@/components/affectations/AffectationDetailModal';
import { DataTableShell, SortTh, TableActions, useTableSort } from '@/components/DataTable';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import {
  COULEUR_LABEL,
  type Affectation,
  type CouleurToner,
  type Imprimante,
  type ModeleCartouche,
} from '@/lib/types';

const KIT: CouleurToner[] = [
  'TONER_BLACK',
  'TONER_CYAN',
  'TONER_MAGENTA',
  'TONER_YELLOW',
];

type PoseLigne = {
  key: string;
  couleur: CouleurToner;
  qte: number;
};

type PoseForm = {
  datePose: string;
  heurePose: string;
  imprimanteId: string;
  modeleId: string;
  mode: 'kit' | 'partiel';
  lignes: PoseLigne[];
};

function newLigne(couleur: CouleurToner = 'TONER_BLACK', qte = 1): PoseLigne {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    couleur,
    qte,
  };
}

function kitLignes(): PoseLigne[] {
  return KIT.map((couleur) => newLigne(couleur, 1));
}

function hasFullCmyk(lignes: PoseLigne[]): boolean {
  const set = new Set(lignes.map((l) => l.couleur));
  return KIT.every((c) => set.has(c));
}

function nextFreeCouleur(lignes: PoseLigne[]): CouleurToner | null {
  const used = new Set(lignes.map((l) => l.couleur));
  return KIT.find((c) => !used.has(c)) ?? null;
}

function emptyForm(printers: Imprimante[], modeles: ModeleCartouche[]): PoseForm {
  return {
    datePose: new Date().toISOString().slice(0, 10),
    heurePose: new Date().toTimeString().slice(0, 5),
    imprimanteId: printers[0]?.id || '',
    modeleId: modeles[0]?.id || '',
    mode: 'kit',
    lignes: kitLignes(),
  };
}

function heureFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toTimeString().slice(0, 5);
}

type RecenceFilter = 'all' | 'today' | '7d' | '30d' | '90d';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function matchesRecence(datePose: string, recence: RecenceFilter): boolean {
  if (recence === 'all') return true;
  const pose = new Date(datePose);
  if (Number.isNaN(pose.getTime())) return false;
  const today = startOfDay(new Date());
  const poseDay = startOfDay(pose);
  const diffDays = Math.floor((today.getTime() - poseDay.getTime()) / 86_400_000);
  if (recence === 'today') return diffDays === 0;
  if (recence === '7d') return diffDays >= 0 && diffDays <= 7;
  if (recence === '30d') return diffDays >= 0 && diffDays <= 30;
  if (recence === '90d') return diffDays >= 0 && diffDays <= 90;
  return true;
}

export default function AffectationsPage() {
  const [rows, setRows] = useState<Affectation[]>([]);
  const [printers, setPrinters] = useState<Imprimante[]>([]);
  const [modeles, setModeles] = useState<ModeleCartouche[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoKitHint, setAutoKitHint] = useState(false);
  const [q, setQ] = useState('');
  const [recence, setRecence] = useState<RecenceFilter>('30d');
  const [form, setForm] = useState<PoseForm>(emptyForm([], []));
  const { sortKey, sortDir, toggle, sort } = useTableSort<Affectation>('datePose', 'desc');

  async function load() {
    const [a, p, m] = await Promise.all([
      api.assignments.list(),
      api.printers.list(),
      api.stock.modeles(),
    ]);
    setRows(a);
    const active = p.filter((x) => x.statut !== 'RETIREE');
    setPrinters(active);
    setModeles(m);
    setForm((f) => ({
      ...f,
      imprimanteId: f.imprimanteId || active[0]?.id || '',
      modeleId: f.modeleId || m[0]?.id || '',
    }));
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  function openCreate() {
    setError(null);
    setOk(null);
    setAutoKitHint(false);
    setEditingId(null);
    setForm(emptyForm(printers, modeles));
    setOpen(true);
  }

  function openEdit(row: Affectation) {
    setError(null);
    setOk(null);
    setAutoKitHint(false);
    setEditingId(row.id);
    const lignesRaw = row.lignes ?? [];
    const lignes: PoseLigne[] =
      lignesRaw.length > 0
        ? lignesRaw.map((l) => newLigne(l.couleur, l.qte))
        : [newLigne()];
    const isKit = hasFullCmyk(lignes);
    setForm({
      datePose: row.datePose.slice(0, 10),
      heurePose: heureFromIso(row.heurePose),
      imprimanteId: row.imprimanteId,
      modeleId: row.modeleId,
      mode: isKit ? 'kit' : 'partiel',
      lignes: isKit && lignes.length !== 4 ? kitLignes() : lignes,
    });
    setOpen(true);
  }

  function setMode(mode: 'kit' | 'partiel') {
    setAutoKitHint(false);
    setForm((prev) => {
      if (mode === 'kit') {
        return { ...prev, mode: 'kit', lignes: kitLignes() };
      }
      // Partiel : garder les lignes existantes, sinon une seule
      const lignes =
        prev.mode === 'kit'
          ? [newLigne(prev.lignes[0]?.couleur ?? 'TONER_BLACK', prev.lignes[0]?.qte ?? 1)]
          : prev.lignes.length
            ? prev.lignes
            : [newLigne()];
      return { ...prev, mode: 'partiel', lignes };
    });
  }

  function addLigne() {
    const free = nextFreeCouleur(form.lignes);
    if (!free) return;
    const lignes = [...form.lignes, newLigne(free, 1)];
    if (hasFullCmyk(lignes)) {
      setAutoKitHint(true);
      setForm((prev) => ({ ...prev, mode: 'kit', lignes: kitLignes() }));
      return;
    }
    setAutoKitHint(false);
    setForm((prev) => ({ ...prev, mode: 'partiel', lignes }));
  }

  function removeLigne(key: string) {
    setAutoKitHint(false);
    setForm((prev) => {
      const lignes =
        prev.lignes.length <= 1 ? prev.lignes : prev.lignes.filter((l) => l.key !== key);
      return {
        ...prev,
        mode: hasFullCmyk(lignes) ? 'kit' : 'partiel',
        lignes,
      };
    });
  }

  function updateLigne(key: string, patch: Partial<PoseLigne>) {
    const lignes = form.lignes.map((l) => (l.key === key ? { ...l, ...patch } : l));
    const couleurs = lignes.map((l) => l.couleur);
    if (new Set(couleurs).size !== couleurs.length) return;

    if (hasFullCmyk(lignes)) {
      setAutoKitHint(true);
      setForm((prev) => ({ ...prev, mode: 'kit', lignes: kitLignes() }));
      return;
    }
    setAutoKitHint(false);
    setForm((prev) => ({ ...prev, mode: 'partiel', lignes }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const lignes =
        form.mode === 'kit'
          ? KIT.map((couleur) => ({
              couleur,
              qte: form.lignes.find((l) => l.couleur === couleur)?.qte ?? 1,
            }))
          : form.lignes.map((l) => ({
              couleur: l.couleur,
              qte: Math.max(1, l.qte),
            }));

      if (lignes.length === 0) {
        setError('Ajoutez au moins une couleur');
        return;
      }

      const payload: Record<string, unknown> = {
        datePose: form.datePose,
        imprimanteId: form.imprimanteId,
        modeleId: form.modeleId,
        motif: 'REMPLACEMENT_NORMAL',
        lignes,
      };
      if (form.heurePose) payload.heurePose = form.heurePose;

      const isStandardKit =
        form.mode === 'kit' && lignes.length === 4 && lignes.every((l) => l.qte === 1);

      if (editingId) {
        const updated = await api.assignments.update(editingId, payload);
        setOk(`${updated.code} modifiée`);
        setOpen(false);
        setEditingId(null);
        await load();
        setDetailId(updated.id);
      } else if (isStandardKit) {
        const created = await api.assignments.kit({
          datePose: form.datePose,
          heurePose: form.heurePose,
          imprimanteId: form.imprimanteId,
          modeleId: form.modeleId,
          motif: 'REMPLACEMENT_NORMAL',
        });
        setOk(`${created.code} créée (kit CMYK)`);
        setOpen(false);
        await load();
        setDetailId(created.id);
      } else {
        const created = await api.assignments.create(payload);
        setOk(
          `${created.code} créée (${form.mode === 'kit' ? 'kit CMYK' : 'partiel'})`,
        );
        setOpen(false);
        await load();
        setDetailId(created.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: Affectation) {
    if (
      !window.confirm(
        `Supprimer la pose ${row.code} ? Le stock des cartouches sera rétabli.`,
      )
    ) {
      return;
    }
    setError(null);
    setOk(null);
    try {
      await api.assignments.remove(row.id);
      setOk(`${row.code} supprimée`);
      if (detailId === row.id) setDetailId(null);
      if (editingId === row.id) {
        setOpen(false);
        setEditingId(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesRecence(r.datePose, recence)) return false;
      if (!needle) return true;
      const serie = r.imprimante?.numeroSerie?.toLowerCase() ?? '';
      const code = r.code?.toLowerCase() ?? '';
      const loc = r.imprimante?.localisation?.toLowerCase() ?? '';
      const modele = r.modele?.modele?.toLowerCase() ?? '';
      return (
        serie.includes(needle) ||
        code.includes(needle) ||
        loc.includes(needle) ||
        modele.includes(needle)
      );
    });
  }, [rows, q, recence]);

  const sortedRows = useMemo(
    () =>
      sort(filteredRows, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'datePose') return row.datePose;
        if (key === 'heure') return row.heurePose ?? '';
        if (key === 'imprimante') return row.imprimante?.numeroSerie ?? '';
        if (key === 'localisation') return row.imprimante?.localisation ?? '';
        if (key === 'modele') return row.modele?.modele ?? '';
        if (key === 'lignes') return (row.lignes ?? []).length;
        if (key === 'statut') return row.statutPose;
        return '';
      }),
    [filteredRows, sort],
  );

  const canAddLigne = form.mode === 'partiel' && form.lignes.length < 4;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Affectations</h1>
          <p>Cliquez une ligne pour voir l’imprimante et les cartouches posées</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openCreate}>
          + Nouvelle pose
        </button>
      </div>

      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Rechercher N° série ou localisation…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 280 }}
          aria-label="Rechercher par numéro de série ou localisation"
        />
        <select
          className="select"
          value={recence}
          onChange={(e) => setRecence(e.target.value as RecenceFilter)}
          aria-label="Filtrer par récence"
        >
          <option value="today">Aujourd’hui</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="all">Toutes les dates</option>
        </select>
        <span className="muted" style={{ fontSize: '0.9rem' }}>
          {filteredRows.length} / {rows.length} pose{rows.length > 1 ? 's' : ''}
        </span>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="msg-ok">{ok}</p> : null}

      <Modal
        open={open}
        wide
        eyebrow={editingId ? 'MODIFIER' : 'NOUVEAU'}
        title={editingId ? 'Modifier la pose' : 'Nouvelle pose cartouche'}
        subtitle="Renseignez la date, le N° série et les couleurs posées."
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          setAutoKitHint(false);
        }}
        footer={
          <>
            <ModalCloseButton
              onClick={() => {
                setOpen(false);
                setEditingId(null);
                setAutoKitHint(false);
              }}
              label="Annuler"
            />
            <ModalSubmitButton form="aff-form" disabled={saving}>
              {saving
                ? 'Enregistrement…'
                : editingId
                  ? 'Enregistrer'
                  : form.mode === 'kit'
                    ? 'Créer kit CMYK'
                    : `Créer (${form.lignes.length} couleur${form.lignes.length > 1 ? 's' : ''})`}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="aff-form" className="modal-form" onSubmit={submit}>
          <div className="modal-form-row">
            <label>Date</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="date"
                value={form.datePose}
                onChange={(e) => setForm({ ...form, datePose: e.target.value })}
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
                value={form.heurePose}
                onChange={(e) => setForm({ ...form, heurePose: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Mode</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.mode}
                onChange={(e) => setMode(e.target.value as 'kit' | 'partiel')}
              >
                <option value="kit">Kit CMYK (4 couleurs)</option>
                <option value="partiel">Partiel (1 à 3 couleurs)</option>
              </select>
              {autoKitHint ? (
                <p className="muted" style={{ marginTop: '0.4rem' }}>
                  Les 4 couleurs sont sélectionnées → passage automatique en kit CMYK.
                </p>
              ) : null}
            </div>
          </div>
          <div className="modal-form-row">
            <label>N° série imprimante</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.imprimanteId}
                onChange={(e) => setForm({ ...form, imprimanteId: e.target.value })}
                required
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numeroSerie}
                    {p.localisation ? ` — ${p.localisation}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-form-row">
            <label>Modèle cartouche</label>
            <div className="modal-field">
              <select
                className="modal-select"
                value={form.modeleId}
                onChange={(e) => setForm({ ...form, modeleId: e.target.value })}
                required
              >
                {modeles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.modele}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.mode === 'kit' ? (
            <div className="stock-entree-lines">
              <div className="stock-entree-lines-head">
                <span>Kit CMYK — 4 couleurs</span>
              </div>
              <div className="aff-cartridge-grid" style={{ marginTop: '0.5rem' }}>
                {KIT.map((c) => (
                  <div
                    key={c}
                    className={`aff-cartridge-card ${
                      c === 'TONER_BLACK'
                        ? 'is-black'
                        : c === 'TONER_CYAN'
                          ? 'is-cyan'
                          : c === 'TONER_MAGENTA'
                            ? 'is-magenta'
                            : 'is-yellow'
                    }`}
                  >
                    <span className="stock-sku-dot" />
                    <div>
                      <strong>{COULEUR_LABEL[c]}</strong>
                      <p>
                        Quantité <b>×1</b>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: '0.65rem' }}>
                Pour poser seulement certaines couleurs, passez en mode <strong>Partiel</strong>.
              </p>
            </div>
          ) : (
            <>
              <div className="stock-entree-lines-head">
                <span>Couleurs à poser</span>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={addLigne}
                  disabled={!canAddLigne}
                >
                  + Ajouter une couleur
                </button>
              </div>
              <div className="stock-entree-lines">
                {form.lignes.map((ligne, index) => {
                  const usedByOthers = new Set(
                    form.lignes.filter((l) => l.key !== ligne.key).map((l) => l.couleur),
                  );
                  const options = KIT.filter(
                    (c) => c === ligne.couleur || !usedByOthers.has(c),
                  );
                  return (
                    <div key={ligne.key} className="stock-entree-line">
                      <div className="stock-entree-line-head">
                        <strong>Couleur {index + 1}</strong>
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
                          <label className="stock-inline-label">Couleur</label>
                          <select
                            className="modal-select"
                            value={ligne.couleur}
                            onChange={(e) =>
                              updateLigne(ligne.key, {
                                couleur: e.target.value as CouleurToner,
                              })
                            }
                          >
                            {options.map((c) => (
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
                            onChange={(e) =>
                              updateLigne(ligne.key, {
                                qte: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                Astuce : dès que Black, Cyan, Magenta et Yellow sont présents, le mode
                passe automatiquement en kit CMYK.
              </p>
            </>
          )}
        </form>
      </Modal>

      <AffectationDetailModal
        affectationId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(row) => {
          setDetailId(null);
          openEdit(row);
        }}
        onDelete={(row) => {
          setDetailId(null);
          void removeRow(row);
        }}
      />

      <DataTableShell
        empty={sortedRows.length === 0}
        emptyMessage={
          rows.length === 0
            ? 'Aucune pose'
            : 'Aucune pose ne correspond à la recherche / au filtre'
        }
      >
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Code" sortKey="code" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Date" sortKey="datePose" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Heure" sortKey="heure" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="N° série" sortKey="imprimante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Modèle" sortKey="modele" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Lignes" sortKey="lignes" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={r.id}
                className={detailId === r.id ? 'is-selected is-clickable' : 'is-clickable'}
                onClick={() => setDetailId(r.id)}
              >
                <td className="mono">{r.code}</td>
                <td>{formatDate(r.datePose)}</td>
                <td className="mono">{formatTime(r.heurePose)}</td>
                <td className="mono">{r.imprimante?.numeroSerie ?? '—'}</td>
                <td>{r.imprimante?.localisation ?? '—'}</td>
                <td>{r.modele?.modele}</td>
                <td>
                  {(r.lignes ?? [])
                    .map((l) => `${COULEUR_LABEL[l.couleur]}×${l.qte}`)
                    .join(', ') || '—'}
                </td>
                <td>
                  <span className="badge badge-ok">{r.statutPose}</span>
                </td>
                <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <TableActions
                    onView={() => setDetailId(r.id)}
                    onEdit={() => openEdit(r)}
                    onDelete={() => void removeRow(r)}
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
