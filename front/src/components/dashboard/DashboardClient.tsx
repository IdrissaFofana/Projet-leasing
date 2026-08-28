'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, DonutChart, LineChart } from '@/components/dashboard/charts';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatMoisLabel, formatMoney, lastMonths } from '@/lib/format';
import { ESAY } from '@/lib/theme';
import {
  STATUT_IMP_LABEL,
  type ControlView,
  type DashboardSummary,
  type FacturePeriode,
  type Imprimante,
  type MonthlyView,
  type StatutImprimante,
} from '@/lib/types';

type DashData = {
  summary: DashboardSummary;
  printers: Imprimante[];
  monthlyTrend: Array<{ mois: string; noir: number; couleur: number }>;
  control: ControlView | null;
  billing: Array<FacturePeriode & { _count?: { lignes: number } }>;
  unreadNotifs: number;
};

const SHORTCUTS = [
  { href: '/imprimantes', label: 'Copieurs', desc: 'Parc copieurs' },
  { href: '/releves', label: 'Relevés', desc: 'Compteurs' },
  { href: '/stock', label: 'Stock', desc: 'Cartouches' },
  { href: '/affectations', label: 'Poses', desc: 'Affectations' },
  { href: '/campagnes', label: 'Campagnes', desc: 'Saisie mensuelle' },
  { href: '/maintenance', label: 'Maintenance', desc: 'Interventions' },
  { href: '/facturation', label: 'Facturation', desc: 'Périodes', roles: ['ADMIN', 'FACTURATION'] as const },
  { href: '/messagerie', label: 'Messagerie', desc: 'Équipe' },
] as const;

function scoreTone(score: number) {
  if (score === 0) return 'is-ok';
  if (score <= 3) return 'is-warn';
  return 'is-danger';
}

function greetingName(nom: string, prenom?: string | null) {
  if (prenom?.trim()) return prenom.trim();
  return nom.split(' ')[0] ?? nom;
}

export function DashboardClient() {
  const { user } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const summary = await api.dashboard();
      const months = lastMonths(6, summary.moisCourant);
      const canBill = user?.role === 'ADMIN' || user?.role === 'FACTURATION';

      const [printers, control, billing, unreadNotifs, ...monthlyResults] = await Promise.all([
        api.printers.list(),
        api.readings.control(summary.moisCourant).catch(() => null),
        canBill ? api.billing.list().catch(() => []) : Promise.resolve([]),
        api.notifications.unreadCount().catch(() => ({ count: 0 })),
        ...months.map((mois) =>
          api.readings.monthlyView(mois).catch(
            (): MonthlyView => ({
              mois,
              lignes: [],
              totaux: { deltaNoir: 0, deltaCouleur: 0, deltaTotal: 0, nbImprimantes: 0 },
            }),
          ),
        ),
      ]);

      const monthlyTrend = months.map((mois, i) => ({
        mois,
        noir: monthlyResults[i]?.totaux.deltaNoir ?? 0,
        couleur: monthlyResults[i]?.totaux.deltaCouleur ?? 0,
      }));

      setData({
        summary,
        printers,
        monthlyTrend,
        control,
        billing: billing as DashData['billing'],
        unreadNotifs: unreadNotifs.count,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const parcSegments = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = {};
    for (const p of data.printers) {
      if (p.statut === 'RETIREE') continue;
      counts[p.statut] = (counts[p.statut] ?? 0) + 1;
    }
    const colors: Record<StatutImprimante, string> = {
      FONCTIONNELLE: ESAY.blueBtn,
      EN_MAINTENANCE: ESAY.blue,
      HORS_SERVICE: ESAY.navySoft,
      RETIREE: '#94a3b8',
    };
    return (Object.keys(counts) as StatutImprimante[]).map((k) => ({
      label: STATUT_IMP_LABEL[k],
      value: counts[k],
      color: colors[k],
    }));
  }, [data]);

  const maintenanceSoon = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const in7 = now + 7 * 86400000;
    return data.printers
      .filter((p) => {
        if (!p.prochaineMaintenance || p.statut === 'RETIREE') return false;
        const t = new Date(p.prochaineMaintenance).getTime();
        return t >= now - 86400000 && t <= in7;
      })
      .sort(
        (a, b) =>
          new Date(a.prochaineMaintenance!).getTime() - new Date(b.prochaineMaintenance!).getTime(),
      )
      .slice(0, 5);
  }, [data]);

  const billingBars = useMemo(() => {
    if (!data?.billing.length) return [];
    return [...data.billing]
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .slice(-6)
      .map((p) => ({
        label: formatMoisLabel(p.mois),
        value: Number(p.montantTotal) || 0,
        color: ESAY.blueBtn,
      }));
  }, [data]);

  const shortcuts = useMemo(
    () =>
      SHORTCUTS.filter(
        (s) => !('roles' in s) || !s.roles || (user?.role && s.roles.includes(user.role as 'ADMIN' | 'FACTURATION')),
      ),
    [user?.role],
  );

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-loading-pulse" />
        <p>Chargement du tableau de bord…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-head">
        <h1>Tableau de bord</h1>
        <PageFeedback
          error={error ?? 'Données indisponibles'}
          onDismiss={() => setError(null)}
        />
        <button type="button" className="btn btn-esay" onClick={() => void load()}>
          Réessayer
        </button>
      </div>
    );
  }

  const { summary, monthlyTrend, control, unreadNotifs } = data;
  const chartLabels = monthlyTrend.map((m) => formatMoisLabel(m.mois));
  const totalCopies = monthlyTrend.reduce((s, m) => s + m.noir + m.couleur, 0);
  const moisCopies = monthlyTrend[monthlyTrend.length - 1];

  const alerts = [
    { label: 'Stock bas', value: summary.alertes.stockBas, href: '/stock', level: summary.alertes.stockBas > 0 ? 'warn' : 'ok' },
    { label: 'Stock épuisé', value: summary.alertes.stockEpuise, href: '/stock', level: summary.alertes.stockEpuise > 0 ? 'danger' : 'ok' },
    { label: 'Anomalies relevés', value: summary.alertes.anomaliesReleves, href: '/releves', level: summary.alertes.anomaliesReleves > 0 ? 'danger' : 'ok' },
    { label: 'Maintenance < 7 j', value: summary.alertes.maintenancesProches, href: '/maintenance', level: summary.alertes.maintenancesProches > 0 ? 'warn' : 'ok' },
  ] as const;

  const controlSegments = control
    ? [
        { label: 'OK', value: control.resume.ok, color: ESAY.blueBtn },
        { label: 'Anomalies', value: control.resume.anomalies, color: ESAY.blue },
        { label: 'Écarts 301', value: control.resume.ecartsNonNuls, color: ESAY.navySoft },
        { label: 'Bases init.', value: control.resume.bases, color: '#94a3b8' },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <div className="dash">
      <header className="dash-hero">
        <div className="dash-hero-text">
          <p className="dash-eyebrow">Suivi leasing</p>
          <h1>Bonjour, {greetingName(user?.nom ?? 'Utilisateur', user?.prenom)}</h1>
          <p>
            Période <strong>{summary.moisCourant}</strong>
            {unreadNotifs > 0 ? (
              <>
                {' '}
                · <Link href="/messagerie">{unreadNotifs} notification(s)</Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="dash-hero-actions">
          <div className={`dash-score ${scoreTone(summary.scoreAlertes)}`}>
            <span className="dash-score-val">{summary.scoreAlertes}</span>
            <span className="dash-score-lbl">Alertes</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost-light"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
      </header>

      <section className="kpi-grid dash-kpi-grid">
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 18h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Parc actif</p>
            <p className="kpi-value">{summary.parc.actives}</p>
            <p className="kpi-meta">{summary.parc.retirees} retirée(s)</p>
          </div>
        </article>
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 8.2 12 4l7.5 4.2v7.6L12 20l-7.5-4.2V8.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Activité 30 j</p>
            <p className="kpi-value">{summary.activite30j.entrees + summary.activite30j.affectations}</p>
            <p className="kpi-meta">
              {summary.activite30j.entrees} entrées · {summary.activite30j.affectations} poses
            </p>
          </div>
        </article>
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 18V6l8-3 8 3v12l-8 3-8-3z" stroke="currentColor" strokeWidth="1.8"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Alertes stock</p>
            <p className="kpi-value">{summary.stock.alertesBas + summary.stock.epuises}</p>
            <p className="kpi-meta">
              {summary.stock.alertesBas} bas · {summary.stock.epuises} épuisé(s)
            </p>
          </div>
        </article>
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Anomalies</p>
            <p className="kpi-value">{summary.releves.anomalies}</p>
            <p className="kpi-meta">relevés compteurs</p>
          </div>
        </article>
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Maintenance</p>
            <p className="kpi-value">{summary.maintenance.aVenir7j}</p>
            <p className="kpi-meta">échéance &lt; 7 jours</p>
          </div>
        </article>
        <article className="kpi-card dash-kpi">
          <div className="kpi-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6h12v12H6z" stroke="currentColor" strokeWidth="1.8"/><path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="kpi-body">
            <p className="kpi-label">Facture mois</p>
            <p className="kpi-value dash-kpi-money">
              {summary.facturation ? formatMoney(summary.facturation.montantTotal) : '—'}
            </p>
            <p className="kpi-meta">{summary.facturation?.statut ?? 'non calculée'}</p>
          </div>
        </article>
      </section>

      <div className="dash-grid">
        <section className="panel dash-panel dash-panel-wide">
          <div className="dash-panel-head">
            <div>
              <h2>Volume copies (6 mois)</h2>
              <p className="dash-panel-sub">
                {totalCopies.toLocaleString('fr-FR')} copies cumulées · ce mois{' '}
                {(moisCopies.noir + moisCopies.couleur).toLocaleString('fr-FR')}
              </p>
            </div>
            <Link href="/releves" className="dash-link">
              Voir relevés
            </Link>
          </div>
          <LineChart
            labels={chartLabels}
            series={[
              { label: 'Noir', color: ESAY.blue, values: monthlyTrend.map((m) => m.noir) },
              { label: 'Couleur', color: ESAY.blueBtn, values: monthlyTrend.map((m) => m.couleur) },
            ]}
          />
        </section>

        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <h2>État du parc</h2>
            <Link href="/imprimantes" className="dash-link">
              Liste
            </Link>
          </div>
          {parcSegments.length ? (
            <DonutChart
              segments={parcSegments}
              centerValue={summary.parc.actives}
              centerLabel="actives"
            />
          ) : (
            <p className="empty-state">Aucun copieur actif</p>
          )}
        </section>

        {billingBars.length > 0 ? (
          <section className="panel dash-panel">
            <div className="dash-panel-head">
              <h2>Facturation</h2>
              <Link href="/facturation" className="dash-link">
                Détail
              </Link>
            </div>
            <BarChart items={billingBars} />
          </section>
        ) : null}

        {controlSegments.length > 0 ? (
          <section className="panel dash-panel">
            <div className="dash-panel-head">
              <h2>Contrôle relevés</h2>
              <Link href="/releves" className="dash-link">
                {summary.moisCourant}
              </Link>
            </div>
            <DonutChart
              segments={controlSegments}
              centerValue={control?.resume.total ?? 0}
              centerLabel="relevés"
            />
          </section>
        ) : null}

        <section className="panel dash-panel">
          <h2>Alertes</h2>
          <ul className="alert-list dash-alert-list">
            {alerts.map((a) => (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className={`alert-item dash-alert-item${a.level === 'warn' ? ' is-warn' : ''}${
                    a.level === 'danger' ? ' is-danger' : ''
                  }`}
                >
                  <span>{a.label}</span>
                  <strong>{a.value}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel dash-panel">
          <div className="dash-panel-head">
            <h2>Maintenance proche</h2>
            <Link href="/maintenance" className="dash-link">
              Planning
            </Link>
          </div>
          {maintenanceSoon.length ? (
            <ul className="dash-maint-list">
              {maintenanceSoon.map((p) => (
                <li key={p.id}>
                  <Link href={`/imprimantes?id=${p.id}`}>
                    <span className="mono">{p.code}</span>
                    <span>{p.localisation ?? p.modele}</span>
                    <time dateTime={p.prochaineMaintenance!.slice(0, 10)}>
                      {new Date(p.prochaineMaintenance!).toLocaleDateString('fr-FR')}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Aucune échéance sous 7 jours</p>
          )}
        </section>

        <section className="panel dash-panel dash-panel-wide">
          <h2>Raccourcis</h2>
          <div className="dash-shortcuts">
            {shortcuts.map((s) => (
              <Link key={s.href} href={s.href} className="dash-shortcut">
                <span className="dash-shortcut-body">
                  <strong>{s.label}</strong>
                  <small>{s.desc}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
