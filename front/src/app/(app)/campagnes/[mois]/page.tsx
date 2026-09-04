'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { FileDropzone } from '@/components/FileDropzone';
import {
  CounterWithPrevious,
  previousReadingSummary,
} from '@/components/reading/CounterWithPrevious';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Campagne, CampagneLigne, Imprimante, ObservationReleve } from '@/lib/types';
import { OBSERVATION_RELEVE_LABEL } from '@/lib/types';

function ligneBadge(statut: string, liee?: boolean) {
  if (liee) return 'badge badge-info';
  if (statut === 'PRET') return 'badge badge-ok';
  if (statut === 'BROUILLON') return 'badge badge-warn';
  if (statut === 'ANOMALIE' || statut === 'DOUBLON_POSSIBLE') return 'badge badge-danger';
  return 'badge badge-muted';
}

function rapportNom(l: CampagneLigne) {
  return l.rapportNom ?? l.releveRapportNom ?? null;
}

export default function CampagneDetailPage() {
  const { confirm } = useFeedback();
  const router = useRouter();
  const { hasCrudPermission } = useAuth();
  const canUpdate = hasCrudPermission('campaigns', 'update');
  const canDelete = hasCrudPermission('campaigns', 'delete');
  const params = useParams<{ mois: string }>();
  const mois = params.mois;
  const [campagne, setCampagne] = useState<Campagne | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [printers, setPrinters] = useState<Imprimante[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printerQ, setPrinterQ] = useState('');
  const { sortKey, sortDir, toggle, sort } = useTableSort<CampagneLigne>('localisation');

  async function load() {
    try {
      setCampagne(await api.campaigns.get(mois));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Campagne introuvable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  async function saveLigne(ligne: CampagneLigne) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.campaigns.updateLigne(mois, ligne.imprimanteId, {
        c112: ligne.c112,
        c113: ligne.c113,
        c122: ligne.c122,
        c123: ligne.c123,
        c501: ligne.c501,
        scanNoir: ligne.scanNoir,
        scanCouleur: ligne.scanCouleur,
        envoi: ligne.envoi,
        observationMotif: ligne.observationMotif || null,
        observations: ligne.observations,
      });
      setOk(`Ligne ${ligne.imprimante?.code} enregistrée (${ligne.statutLigne})`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sauvegarde impossible');
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (
      !(await confirm({
        title: 'Confirmation',
        message: 'Archiver les lignes prêtes (ou en anomalie) vers les relevés ?',
        danger: true,
        confirmLabel: 'Archiver',
      }))
    )
      return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api.campaigns.archive(mois);
      const okCount = res.archives.filter((a) => a.code && !a.error).length;
      const errs = res.archives.filter((a) => a.error);
      if (errs.length > 0) {
        setError(
          `${errs.length} échec(s) : ${errs.map((e) => e.error).join(' · ')}`,
        );
      }
      if (okCount > 0) {
        setOk(
          `${okCount} relevé(s) créé(s)${res.campagneCloturee ? ' — campagne clôturée' : ''}${
            res.restantes > 0 ? ` · ${res.restantes} ligne(s) restante(s)` : ''
          }`,
        );
      } else if (errs.length === 0) {
        setOk('Archivage terminé');
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Archive impossible');
    } finally {
      setBusy(false);
    }
  }

  async function reopenCampagne() {
    if (
      !(await confirm({
        title: 'Ouvrir pour correction',
        message:
          'Rouvrir la campagne pour corriger des valeurs, ajouter ou retirer des copieurs ? Les lignes déjà liées resteront liées jusqu’à ce que vous les déliez.',
        confirmLabel: 'Ouvrir',
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.campaigns.reopen(mois);
      setOk('Campagne ouverte pour correction — déliez une ligne pour la modifier, puis ré-archivez');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Réouverture impossible');
    } finally {
      setBusy(false);
    }
  }

  async function unlinkLigne(ligne: CampagneLigne) {
    if (
      !(await confirm({
        title: 'Délier pour corriger',
        message: `Supprimer le relevé lié de ${ligne.imprimante?.code ?? 'ce copieur'} et rendre la ligne éditable ? Vous pourrez corriger puis ré-archiver. Impossible si la facture du mois est clôturée.`,
        danger: true,
        confirmLabel: 'Délier',
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.campaigns.unlinkLigne(mois, ligne.imprimanteId);
      setOk(`Ligne ${ligne.imprimante?.code} déliée — corrigez puis ré-archivez`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Déliaison impossible');
    } finally {
      setBusy(false);
    }
  }

  async function exportLeasingMensuelle() {
    setError(null);
    try {
      await api.reports.leasingMensuelle(mois);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Rapport leasing mensuel impossible');
    }
  }

  async function exportFile(format: 'xlsx' | 'pdf') {
    setError(null);
    try {
      await api.campaigns.exportFile(mois, format);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }

  async function openAddModal() {
    setError(null);
    setSelectedIds(new Set());
    setPrinterQ('');
    setAddOpen(true);
    try {
      const list = await api.printers.list();
      setPrinters(list.filter((p) => p.statut !== 'RETIREE'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Impossible de charger les copieurs');
    }
  }

  const inCampaignIds = useMemo(
    () => new Set(campagne?.lignes?.map((l) => l.imprimanteId) ?? []),
    [campagne?.lignes],
  );

  const availablePrinters = useMemo(() => {
    let list = printers.filter((p) => !inCampaignIds.has(p.id));
    if (printerQ.trim()) {
      const qq = printerQ.toLowerCase();
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(qq) ||
          (p.localisation ?? '').toLowerCase().includes(qq) ||
          (p.modele ?? '').toLowerCase().includes(qq),
      );
    }
    return list;
  }, [printers, inCampaignIds, printerQ]);

  function togglePrinter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitAddPrinters(e: FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      setError('Sélectionnez au moins un copieur');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.campaigns.addLignes(mois, [...selectedIds]);
      setAddOpen(false);
      setOk(`${selectedIds.size} copieur(s) ajouté(s)`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  }

  async function removeCampagne() {
    if (
      !(await confirm({
        title: 'Supprimer la campagne',
        message: `Supprimer la campagne ${mois} ? Cette action est irréversible.`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.campaigns.delete(mois);
      router.push('/campagnes');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  async function uploadRapport(ligne: CampagneLigne, file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.campaigns.uploadRapportLigne(mois, ligne.imprimanteId, file);
      const serverLigne = updated.lignes?.find((l) => l.imprimanteId === ligne.imprimanteId);
      setCampagne((prev) => {
        if (!prev?.lignes) return updated;
        return {
          ...prev,
          lignes: prev.lignes.map((l) => {
            if (l.imprimanteId !== ligne.imprimanteId) return l;
            return {
              ...l,
              rapportNom: serverLigne?.rapportNom ?? l.rapportNom,
              rapportPath: serverLigne?.rapportPath ?? l.rapportPath,
              rapportMime: serverLigne?.rapportMime ?? l.rapportMime,
              releveRapportNom: serverLigne?.releveRapportNom ?? l.releveRapportNom,
              releveRapportPath: serverLigne?.releveRapportPath ?? l.releveRapportPath,
            };
          }),
        };
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload rapport impossible');
    } finally {
      setBusy(false);
    }
  }

  async function removeLigne(ligne: CampagneLigne) {
    const linked = !!ligne.archiveVersReleveId;
    if (
      !(await confirm({
        title: 'Retirer le copieur',
        message: linked
          ? `Retirer ${ligne.imprimante?.code ?? 'ce copieur'} et supprimer son relevé lié ?`
          : `Retirer ${ligne.imprimante?.code ?? 'ce copieur'} de la campagne ?`,
        danger: true,
        confirmLabel: 'Retirer',
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.campaigns.removeLigne(mois, ligne.imprimanteId);
      setOk(`Copieur ${ligne.imprimante?.code} retiré`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Retrait impossible');
    } finally {
      setBusy(false);
    }
  }

  function patchLigne(id: string, key: keyof CampagneLigne, value: string) {
    setCampagne((prev) => {
      if (!prev?.lignes) return prev;
      return {
        ...prev,
        lignes: prev.lignes.map((l) => {
          if (l.id !== id) return l;
          if (key === 'observationMotif' || key === 'observations') {
            return { ...l, [key]: value === '' ? null : value };
          }
          return {
            ...l,
            [key]: value === '' ? null : Number(value),
          };
        }),
      };
    });
  }

  const filtered = useMemo(() => {
    let list = campagne?.lignes ?? [];
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(
        (l) =>
          l.imprimante?.code?.toLowerCase().includes(qq) ||
          l.imprimante?.localisation?.toLowerCase().includes(qq) ||
          l.imprimante?.modele?.toLowerCase().includes(qq),
      );
    }
    if (fileFilter === 'a_saisir') list = list.filter((l) => l.statutLigne === 'A_SAISIR');
    if (fileFilter === 'brouillon') list = list.filter((l) => l.statutLigne === 'BROUILLON');
    if (fileFilter === 'pret') list = list.filter((l) => l.statutLigne === 'PRET');
    if (fileFilter === 'liees') list = list.filter((l) => !!l.archiveVersReleveId);
    if (fileFilter === 'anomalie') list = list.filter((l) => l.statutLigne === 'ANOMALIE');
    return list;
  }, [campagne?.lignes, q, fileFilter]);

  const sortedLignes = sort(filtered, (row, key) => {
    if (key === 'imprimante') return row.imprimante?.code ?? '';
    if (key === 'localisation') return row.imprimante?.localisation ?? '';
    if (key === 'c112') return row.c112 ?? -1;
    if (key === 'c113') return row.c113 ?? -1;
    if (key === 'c122') return row.c122 ?? -1;
    if (key === 'c123') return row.c123 ?? -1;
    if (key === 'c501') return row.c501 ?? -1;
    if (key === 'statut') return row.statutLigne;
    return '';
  });

  if (!campagne && !error) {
    return (
      <div className="page-head">
        <h1>Campagne</h1>
        <p>Chargement…</p>
      </div>
    );
  }

  if (!campagne) {
    return (
      <div className="page-head">
        <h1>Campagne</h1>
        <PageFeedback error={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  const resume = {
    total: campagne.lignes?.length ?? 0,
    aSaisir: campagne.lignes?.filter((l) => l.statutLigne === 'A_SAISIR').length ?? 0,
    brouillon: campagne.lignes?.filter((l) => l.statutLigne === 'BROUILLON').length ?? 0,
    pret: campagne.lignes?.filter((l) => l.statutLigne === 'PRET' && !l.archiveVersReleveId).length ?? 0,
    liees: campagne.lignes?.filter((l) => !!l.archiveVersReleveId).length ?? 0,
    anomalies: campagne.lignes?.filter((l) => l.statutLigne === 'ANOMALIE').length ?? 0,
  };

  const hasUnlinked = resume.liees < resume.total;
  const canArchive =
    canUpdate &&
    !busy &&
    (resume.pret > 0 || resume.anomalies > 0) &&
    hasUnlinked;

  return (
    <>
      <div className="page-head">
        <h1>Campagne {campagne.mois}</h1>
        <p>
          <Link href="/campagnes">← Retour</Link> ·{' '}
          {campagne.portee === 'SELECTION' ? (
            <>Sélection · {resume.total} copieur(s) · </>
          ) : (
            <>Tous les copieurs · {resume.total} ligne(s) · </>
          )}
          {campagne.cloturee ? 'Clôturée' : 'Ouverte'} · {resume.aSaisir} à saisir ·{' '}
          {resume.brouillon} brouillon · {resume.pret} prêt(s) · {resume.liees} lié(s) au relevé
          {resume.anomalies > 0 ? ` · ${resume.anomalies} anomalie(s)` : ''}
        </p>
        {campagne.cloturee ? (
          <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.88rem', color: 'var(--danger, #c0392b)' }}>
            Campagne clôturée. Cliquez « Ouvrir pour correction » pour ajouter/retirer un copieur ou délier une ligne
            afin de corriger les compteurs, puis ré-archivez.
          </p>
        ) : null}
        <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>
          Compteurs « anc. » = dernier relevé officiel connu par copieur (pas forcément le mois précédent).
          La saisie partielle reste possible en brouillon.
          Une ligne liée doit être déliée avant modification.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Filtrer copieur / localisation…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={fileFilter} onChange={(e) => setFileFilter(e.target.value)}>
          <option value="">Toutes lignes</option>
          <option value="a_saisir">À saisir</option>
          <option value="brouillon">Brouillons</option>
          <option value="pret">Prêtes</option>
          <option value="liees">Liées au relevé</option>
          <option value="anomalie">Anomalies</option>
        </select>
        {campagne.cloturee && canUpdate ? (
          <button type="button" className="btn btn-soft" disabled={busy} onClick={() => void reopenCampagne()}>
            Ouvrir pour correction
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-soft"
          disabled={busy || campagne.cloturee || !canUpdate}
          onClick={() => void openAddModal()}
        >
          + Ajouter copieur
        </button>
        <button
          type="button"
          className="btn btn-esay"
          disabled={!canArchive}
          onClick={() => void archive()}
        >
          Archiver vers relevés
        </button>
        <button type="button" className="btn btn-soft" onClick={() => void exportFile('xlsx')}>
          Export Excel
        </button>
        <button type="button" className="btn btn-esay" onClick={() => void exportFile('pdf')}>
          Export PDF
        </button>
        <button type="button" className="btn btn-esay" onClick={() => void exportLeasingMensuelle()}>
          Rapport Leasing mensuel
        </button>
        <Link href="/releves" className="btn btn-soft">
          Voir relevés
        </Link>
        {canDelete ? (
          <button
            type="button"
            className="btn btn-soft"
            disabled={busy || campagne.cloturee}
            onClick={() => void removeCampagne()}
          >
            Supprimer campagne
          </button>
        ) : null}
      </div>

      <Modal
        open={addOpen}
        wide
        eyebrow="CAMPAGNE"
        title="Ajouter des copieurs"
        subtitle="Seuls les copieurs absents de la campagne sont proposés."
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setAddOpen(false)} label="Annuler" />
            <ModalSubmitButton form="add-printers-form" disabled={busy}>
              {busy ? 'Ajout…' : 'Ajouter'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="add-printers-form" className="modal-form" onSubmit={(e) => void submitAddPrinters(e)}>
          <div className="modal-form-row is-top">
            <label>Copieurs</label>
            <div className="modal-field">
              <input
                className="modal-input"
                placeholder="Rechercher code, localisation…"
                value={printerQ}
                onChange={(e) => setPrinterQ(e.target.value)}
              />
              <p className="muted" style={{ margin: '0.5rem 0' }}>
                {selectedIds.size} sélectionné(s) · {availablePrinters.length} disponible(s)
              </p>
              <div className="camp-printer-pick">
                {availablePrinters.map((p) => (
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
                {availablePrinters.length === 0 ? (
                  <p className="muted">Aucun copieur disponible à ajouter</p>
                ) : null}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <DataTableShell
        className="campaign-entry-wrap"
        empty={sortedLignes.length === 0}
        emptyMessage="Aucune ligne"
      >
        <table className="data-table campaign-entry-table">
          <thead>
            <tr>
              <SortTh label="Copieur" sortKey="imprimante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              {(['c112', 'c113', 'c122', 'c123', 'c501'] as const).map((k) => (
                <th key={k} data-align="right" className="campaign-entry-counter-col">
                  <div>{k === 'c501' ? '501' : k.slice(1)}</div>
                  <div className="th-sub">anc. / act.</div>
                </th>
              ))}
              <th className="campaign-entry-motif-col">Motif</th>
              <th className="campaign-entry-rapport-col">Rapport</th>
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sortedLignes.map((l) => (
              <tr key={l.id}>
                <td className="mono campaign-entry-sticky-col">
                  {l.imprimante?.code}
                  {l.archiveVersReleveId ? (
                    <>
                      {' '}
                      <Link href={`/releves/${l.archiveVersReleveId}`} className="badge badge-info">
                        Relevé
                      </Link>
                    </>
                  ) : null}
                  <span className="ligne-prev-hint" title={previousReadingSummary(l.previous)}>
                    {l.previous ? `↳ ${l.previous.code} · ${l.previous.moisFacture}` : '↳ base initiale'}
                  </span>
                </td>
                <td className="campaign-entry-loc-col">{l.imprimante?.localisation ?? '—'}</td>
                {(['c112', 'c113', 'c122', 'c123', 'c501'] as const).map((k) => (
                  <td key={k} data-align="right" className="campaign-entry-counter-col">
                    <CounterWithPrevious
                      compact
                      previous={l.previous}
                      counterKey={k}
                      value={l[k]}
                      disabled={!!l.archiveVersReleveId || campagne.cloturee}
                      onChange={(v) => patchLigne(l.id, k, v)}
                    />
                  </td>
                ))}
                <td className="campaign-entry-motif-col">
                  <select
                    className="select campaign-entry-motif"
                    disabled={!!l.archiveVersReleveId || campagne.cloturee}
                    value={l.observationMotif ?? ''}
                    onChange={(e) => patchLigne(l.id, 'observationMotif', e.target.value)}
                  >
                    <option value="">—</option>
                    {(Object.keys(OBSERVATION_RELEVE_LABEL) as ObservationReleve[]).map((k) => (
                      <option key={k} value={k}>{OBSERVATION_RELEVE_LABEL[k]}</option>
                    ))}
                  </select>
                </td>
                <td className="campaign-entry-rapport-col">
                  {rapportNom(l) ? (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm campaign-entry-rapport-btn"
                      title={rapportNom(l) ?? undefined}
                      onClick={() =>
                        void api.campaigns.downloadRapportLigne(
                          mois,
                          l.imprimanteId,
                          rapportNom(l) ?? 'rapport-compteur',
                        )
                      }
                    >
                      {rapportNom(l)}
                    </button>
                  ) : null}
                  <FileDropzone
                    existingName={rapportNom(l)}
                    disabled={campagne.cloturee || !canUpdate || busy}
                    label="Joindre PDF"
                    hint="PDF, JPG · 12 Mo"
                    onFile={(f) => void uploadRapport(l, f)}
                  />
                </td>
                <td>
                  <span className={ligneBadge(l.statutLigne, !!l.archiveVersReleveId)}>
                    {l.archiveVersReleveId ? 'LIÉ' : l.statutLigne}
                  </span>
                  {l.statutLigne === 'ANOMALIE' && l.observations ? (
                    <span
                      className="ligne-prev-hint"
                      style={{ color: 'var(--danger, #c0392b)', whiteSpace: 'normal', maxWidth: 180 }}
                      title={l.observations}
                    >
                      {l.observations}
                    </span>
                  ) : null}
                </td>
                <td className="col-actions">
                  <div className="tbl-actions">
                    {l.archiveVersReleveId && canUpdate && !campagne.cloturee ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        disabled={busy}
                        onClick={() => void unlinkLigne(l)}
                      >
                        Délier
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      disabled={busy || !!l.archiveVersReleveId || campagne.cloturee}
                      onClick={() => void saveLigne(l)}
                    >
                      Sauver
                    </button>
                    {canUpdate ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        disabled={busy || campagne.cloturee}
                        onClick={() => void removeLigne(l)}
                      >
                        Retirer
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
  );
}
