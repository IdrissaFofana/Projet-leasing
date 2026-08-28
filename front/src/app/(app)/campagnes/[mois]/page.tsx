'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Campagne, CampagneLigne, ObservationReleve } from '@/lib/types';
import { OBSERVATION_RELEVE_LABEL } from '@/lib/types';

function ligneBadge(statut: string) {
  if (statut === 'PRET') return 'badge badge-ok';
  if (statut === 'BROUILLON') return 'badge badge-warn';
  if (statut === 'ANOMALIE' || statut === 'DOUBLON_POSSIBLE') return 'badge badge-danger';
  return 'badge badge-muted';
}

export default function CampagneDetailPage() {
  const { confirm } = useFeedback();
  const params = useParams<{ mois: string }>();
  const mois = params.mois;
  const [campagne, setCampagne] = useState<Campagne | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [fileFilter, setFileFilter] = useState('');
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
        c301: ligne.c301,
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
        message: 'Archiver les lignes PRET vers les relevés ?',
        danger: true,
        confirmLabel: 'Archiver',
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.campaigns.archive(mois);
      setOk(
        `${res.archives.length} archivée(s), restantes ${res.restantes}${
          res.campagneCloturee ? ' — campagne clôturée' : ''
        }`,
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Archive impossible');
    } finally {
      setBusy(false);
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
    return list;
  }, [campagne?.lignes, q, fileFilter]);

  const sortedLignes = sort(filtered, (row, key) => {
    if (key === 'imprimante') return row.imprimante?.code ?? '';
    if (key === 'localisation') return row.imprimante?.localisation ?? '';
    if (key === 'c112') return row.c112 ?? -1;
    if (key === 'c113') return row.c113 ?? -1;
    if (key === 'c122') return row.c122 ?? -1;
    if (key === 'c123') return row.c123 ?? -1;
    if (key === 'c301') return row.c301 ?? -1;
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
  };

  return (
    <>
      <div className="page-head">
        <h1>Campagne {campagne.mois}</h1>
        <p>
          <Link href="/campagnes">← Retour</Link> ·{' '}
          {campagne.cloturee ? 'Clôturée' : 'Ouverte'} · {resume.aSaisir} à saisir ·{' '}
          {resume.brouillon} brouillon · {resume.pret} prêt(s)
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
        </select>
        <button
          type="button"
          className="btn btn-esay"
          disabled={busy || campagne.cloturee}
          onClick={() => void archive()}
        >
          Archiver lignes PRET
        </button>
        <button type="button" className="btn btn-soft" onClick={() => void exportFile('xlsx')}>
          Export Excel
        </button>
        <button type="button" className="btn btn-esay" onClick={() => void exportFile('pdf')}>
          Export PDF
        </button>
        <Link href="/releves" className="btn btn-soft">
          Voir relevés
        </Link>
      </div>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <DataTableShell empty={sortedLignes.length === 0} emptyMessage="Aucune ligne">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Copieur" sortKey="imprimante" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Localisation" sortKey="localisation" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="112" sortKey="c112" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="113" sortKey="c113" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="122" sortKey="c122" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="123" sortKey="c123" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <SortTh label="301" sortKey="c301" activeKey={sortKey} direction={sortDir} onSort={toggle} align="right" />
              <th>Motif</th>
              <SortTh label="Statut" sortKey="statut" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sortedLignes.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.imprimante?.code}</td>
                <td>{l.imprimante?.localisation ?? '—'}</td>
                {(['c112', 'c113', 'c122', 'c123', 'c301'] as const).map((k) => (
                  <td key={k} data-align="right">
                    <input
                      className="input"
                      style={{ width: 80 }}
                      type="number"
                      disabled={!!l.archiveVersReleveId || campagne.cloturee}
                      value={l[k] ?? ''}
                      onChange={(e) => patchLigne(l.id, k, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <select
                    className="select"
                    style={{ minWidth: 120 }}
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
                <td><span className={ligneBadge(l.statutLigne)}>{l.statutLigne}</span></td>
                <td className="col-actions">
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={busy || !!l.archiveVersReleveId || campagne.cloturee}
                    onClick={() => void saveLigne(l)}
                  >
                    Sauver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
