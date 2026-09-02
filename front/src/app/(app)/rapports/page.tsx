'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { currentMois } from '@/lib/format';
import type { Maintenance } from '@/lib/types';

type BusyKey =
  | 'mensuel'
  | 'annuel'
  | 'semestriel'
  | 'trimestriel'
  | 'intervention'
  | 'modele'
  | null;

const TYPE_LABEL: Record<string, string> = {
  ASSISTANCE: 'Assistance',
  PREVENTIVE: 'Préventive',
  CORRECTIVE: 'Corrective',
  DEPANNAGE: 'Dépannage',
  NETTOYAGE: 'Nettoyage',
  REMPLACEMENT_PIECE: 'Remplacement pièce',
  CONTROLE_PERIODIQUE: 'Contrôle périodique',
};

function tachesLabel(row: Maintenance) {
  const list = row.taches?.length ? row.taches : row.type ? [row.type] : [];
  return list.map((t) => TYPE_LABEL[t] ?? t).join(', ') || '—';
}

function copieursLabel(row: Maintenance) {
  const codes =
    row.imprimantes?.map((l) => l.imprimante?.code).filter(Boolean) ??
    (row.imprimante?.code ? [row.imprimante.code] : []);
  return codes.join(', ') || '—';
}

export default function RapportsPage() {
  const now = new Date();
  const [mois, setMois] = useState(currentMois());
  const [annee, setAnnee] = useState(String(now.getFullYear()));
  const [semestre, setSemestre] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(
    (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
  );
  const [interventions, setInterventions] = useState<Maintenance[]>([]);
  const [interventionId, setInterventionId] = useState('');
  const [interventionQ, setInterventionQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);

  useEffect(() => {
    void api.maintenance
      .list()
      .then((rows) => {
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(b.dateMaintenance).getTime() - new Date(a.dateMaintenance).getTime(),
        );
        setInterventions(sorted);
        if (sorted[0]) setInterventionId(sorted[0].id);
      })
      .catch(() => {
        /* liste optionnelle si pas de droit maintenance */
      });
  }, []);

  const filteredInterventions = useMemo(() => {
    const q = interventionQ.trim().toLowerCase();
    if (!q) return interventions.slice(0, 80);
    return interventions
      .filter((r) => {
        const hay = `${r.code} ${copieursLabel(r)} ${tachesLabel(r)}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 80);
  }, [interventions, interventionQ]);

  const selected = interventions.find((r) => r.id === interventionId) ?? null;

  async function run(key: BusyKey, action: () => Promise<void>, success: string) {
    setBusy(key);
    setError(null);
    setOk(null);
    try {
      await action();
      setOk(success);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Génération impossible');
    } finally {
      setBusy(null);
    }
  }

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
  }, []);

  return (
    <>
      <div className="page-head">
        <h1>Rapports</h1>
        <p>
          Génération des documents client au format Ivoprest (même mise en page : page de garde,
          sommaire, sections).
        </p>
      </div>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <div className="form-grid" style={{ alignItems: 'stretch' }}>
        <div className="panel">
          <h2>Leasing mensuel</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Relevés, marges, calendrier des assistances et annexes photo pour un mois donné.
          </p>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Mois
          </label>
          <input
            className="input"
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-esay"
              disabled={busy !== null || !mois}
              onClick={() =>
                void run(
                  'mensuel',
                  () => api.reports.leasingMensuelle(mois),
                  `Rapport mensuel ${mois} téléchargé`,
                )
              }
            >
              {busy === 'mensuel' ? 'Génération…' : 'Générer le PDF'}
            </button>
            <Link href={`/facturation/${mois}`} className="btn btn-soft">
              Voir facturation
            </Link>
            <Link href={`/campagnes/${mois}`} className="btn btn-soft">
              Voir campagne
            </Link>
          </div>
        </div>

        <div className="panel">
          <h2>Leasing annuel</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Synthèse annuelle : consommations, dépassements, assistances et interventions par
            tâche.
          </p>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Année
          </label>
          <select
            className="input"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-esay"
              disabled={busy !== null || !/^\d{4}$/.test(annee)}
              onClick={() =>
                void run(
                  'annuel',
                  () => api.reports.leasingAnnuelle(annee),
                  `Rapport annuel ${annee} téléchargé`,
                )
              }
            >
              {busy === 'annuel' ? 'Génération…' : 'Générer le PDF'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Leasing semestriel</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Synthèse sur 6 mois (S1 : janv.–juin · S2 : juil.–déc.).
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                Année
              </label>
              <select
                className="input"
                value={annee}
                onChange={(e) => setAnnee(e.target.value)}
                style={{ maxWidth: 140 }}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                Semestre
              </label>
              <select
                className="input"
                value={semestre}
                onChange={(e) => setSemestre(Number(e.target.value) as 1 | 2)}
                style={{ maxWidth: 200 }}
              >
                <option value={1}>1er semestre (janv.–juin)</option>
                <option value={2}>2e semestre (juil.–déc.)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-esay"
              disabled={busy !== null || !/^\d{4}$/.test(annee)}
              onClick={() =>
                void run(
                  'semestriel',
                  () => api.reports.leasingSemestrielle(annee, semestre),
                  `Rapport semestriel S${semestre} ${annee} téléchargé`,
                )
              }
            >
              {busy === 'semestriel' ? 'Génération…' : 'Générer le PDF'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Leasing trimestriel</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Synthèse sur 3 mois (T1 à T4).
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                Année
              </label>
              <select
                className="input"
                value={annee}
                onChange={(e) => setAnnee(e.target.value)}
                style={{ maxWidth: 140 }}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                Trimestre
              </label>
              <select
                className="input"
                value={trimestre}
                onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}
                style={{ maxWidth: 220 }}
              >
                <option value={1}>1er trimestre (janv.–mars)</option>
                <option value={2}>2e trimestre (avr.–juin)</option>
                <option value={3}>3e trimestre (juil.–sept.)</option>
                <option value={4}>4e trimestre (oct.–déc.)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-esay"
              disabled={busy !== null || !/^\d{4}$/.test(annee)}
              onClick={() =>
                void run(
                  'trimestriel',
                  () => api.reports.leasingTrimestrielle(annee, trimestre),
                  `Rapport trimestriel T${trimestre} ${annee} téléchargé`,
                )
              }
            >
              {busy === 'trimestriel' ? 'Génération…' : 'Générer le PDF'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Intervention</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Compte rendu d’une intervention : copieurs, tâches énumérées, actions et observations.
          </p>
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Filtrer
          </label>
          <input
            className="input"
            placeholder="Code, copieur, tâche…"
            value={interventionQ}
            onChange={(e) => setInterventionQ(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Intervention
          </label>
          <select
            className="input"
            value={interventionId}
            onChange={(e) => setInterventionId(e.target.value)}
          >
            {filteredInterventions.length === 0 ? (
              <option value="">Aucune intervention</option>
            ) : (
              filteredInterventions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {copieursLabel(r)} · {tachesLabel(r)}
                </option>
              ))
            )}
          </select>
          {selected ? (
            <p className="muted" style={{ marginTop: 10, fontSize: '0.9rem' }}>
              <Link href={`/maintenance/${selected.id}`}>Ouvrir la fiche</Link>
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-esay"
              disabled={busy !== null || !interventionId}
              onClick={() =>
                void run(
                  'intervention',
                  () =>
                    api.reports.intervention(
                      interventionId,
                      selected?.code ?? 'intervention',
                    ),
                  `Rapport ${selected?.code ?? ''} téléchargé`,
                )
              }
            >
              {busy === 'intervention' ? 'Génération…' : 'Générer le PDF'}
            </button>
            <Link href="/maintenance" className="btn btn-soft">
              Liste interventions
            </Link>
          </div>
        </div>

        <div className="panel">
          <h2>Modèle mensuel</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            PDF d’exemple avec données fictives — pour valider la structure et la charte.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  'modele',
                  () => api.reports.modeleLeasingMensuelle(),
                  'Modèle mensuel téléchargé',
                )
              }
            >
              {busy === 'modele' ? 'Génération…' : 'Télécharger le modèle'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
