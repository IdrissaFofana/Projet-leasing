'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { BackupRecord, BackupStatus, BackupType } from '@/lib/types';

function formatUtcLocal(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

const STATUS_LABEL: Record<BackupStatus, string> = {
  RUNNING: 'En cours',
  SUCCESS: 'Réussie',
  FAILED: 'Échouée',
};

const TYPE_LABEL: Record<BackupType, string> = {
  DAILY: 'Quotidienne',
  WEEKLY: 'Hebdomadaire',
  MONTHLY: 'Mensuelle',
  MANUAL: 'Manuelle',
};

function StatusBadge({ status }: { status: BackupStatus }) {
  const cls =
    status === 'SUCCESS'
      ? 'badge badge-info'
      : status === 'FAILED'
        ? 'badge badge-warn'
        : 'badge';
  const prefix =
    status === 'SUCCESS' ? '🟢' : status === 'FAILED' ? '🔴' : '🔄';
  return (
    <span className={cls}>
      {prefix} {STATUS_LABEL[status]}
    </span>
  );
}

export default function SauvegardesPage() {
  const { hasCrudPermission } = useAuth();
  const { confirm } = useFeedback();
  const canRun = hasCrudPermission('backups', 'create');

  const [latest, setLatest] = useState<BackupRecord | null>(null);
  const [items, setItems] = useState<BackupRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const { sortKey, sortDir, toggle, sort } = useTableSort<BackupRecord>(
    'startedAt',
    'desc',
  );

  const load = useCallback(async () => {
    const [lat, list] = await Promise.all([
      api.backups.latest(),
      api.backups.list({
        page,
        limit: 20,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
    ]);
    setLatest(lat);
    setItems(list.items);
    setTotal(list.total);
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
      )
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (latest?.status !== 'RUNNING') return;
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [latest?.status, load]);

  async function runBackup() {
    if (
      !(await confirm({
        title: 'Lancer une sauvegarde',
        message:
          'Déclencher une sauvegarde manuelle via le service système (PostgreSQL → OneDrive) ?',
        confirmLabel: 'Lancer',
      }))
    ) {
      return;
    }
    setRunning(true);
    setError(null);
    setOk(null);
    try {
      const created = await api.backups.run();
      setOk('Sauvegarde manuelle démarrée — suivi en cours…');
      setLatest(created);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Déclenchement impossible',
      );
    } finally {
      setRunning(false);
    }
  }

  const sorted = sort(items, (row, key) => {
    if (key === 'type') return row.type;
    if (key === 'status') return row.status;
    if (key === 'size') return row.size ?? 0;
    if (key === 'filename') return row.filename ?? '';
    return row.startedAt;
  });

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Sauvegardes</h1>
          <p>
            Supervision des sauvegardes PostgreSQL (systemd + OneDrive). Les dumps
            restent gérés par le script serveur.
          </p>
        </div>
        {canRun ? (
          <button
            type="button"
            className="btn btn-esay"
            disabled={running || latest?.status === 'RUNNING'}
            onClick={() => void runBackup()}
          >
            {running || latest?.status === 'RUNNING'
              ? 'Sauvegarde en cours…'
              : 'Lancer une sauvegarde'}
          </button>
        ) : null}
      </div>

      <PageFeedback
        error={error}
        ok={ok}
        onDismiss={() => {
          setError(null);
          setOk(null);
        }}
      />

      <section className="panel anim-section" style={{ marginBottom: '1.25rem' }}>
        <h2>Dernière sauvegarde</h2>
        {!latest ? (
          <p className="muted">Aucune sauvegarde enregistrée pour le moment.</p>
        ) : (
          <div className="backup-latest">
            <div style={{ marginBottom: '0.75rem' }}>
              <StatusBadge status={latest.status} />{' '}
              <span className="badge badge-info">{TYPE_LABEL[latest.type]}</span>
            </div>
            {latest.status === 'FAILED' ? (
              <p className="form-error" style={{ marginBottom: '0.75rem' }}>
                Sauvegarde échouée — {latest.errorMessage || 'erreur non détaillée'}
                <br />
                Dernière tentative : {formatUtcLocal(latest.startedAt)}
              </p>
            ) : null}
            <dl className="backup-meta">
              <div>
                <dt>Démarrée</dt>
                <dd>{formatUtcLocal(latest.startedAt)}</dd>
              </div>
              <div>
                <dt>Terminée</dt>
                <dd>{formatUtcLocal(latest.completedAt)}</dd>
              </div>
              <div>
                <dt>Fichier</dt>
                <dd className="mono">{latest.filename || '—'}</dd>
              </div>
              <div>
                <dt>Taille</dt>
                <dd>{formatSize(latest.size)}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd className="mono">{latest.destination || '—'}</dd>
              </div>
              {latest.requestedBy ? (
                <div>
                  <dt>Demandée par</dt>
                  <dd>{latest.requestedBy.nom}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}
      </section>

      <section className="panel anim-section">
        <div className="page-head-row" style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>Historique</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="modal-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
              aria-label="Filtrer par statut"
            >
              <option value="">Tous les statuts</option>
              <option value="SUCCESS">Réussies</option>
              <option value="FAILED">Échouées</option>
              <option value="RUNNING">En cours</option>
            </select>
            <select
              className="modal-select"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
              aria-label="Filtrer par type"
            >
              <option value="">Tous les types</option>
              <option value="DAILY">Quotidienne</option>
              <option value="WEEKLY">Hebdomadaire</option>
              <option value="MONTHLY">Mensuelle</option>
              <option value="MANUAL">Manuelle</option>
            </select>
          </div>
        </div>

        <DataTableShell
          loading={loading}
          empty={!loading && items.length === 0}
          emptyMessage="Aucun historique"
        >
          <table className="data-table">
            <thead>
              <tr>
                <SortTh
                  label="Date"
                  sortKey="startedAt"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggle}
                />
                <SortTh
                  label="Type"
                  sortKey="type"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggle}
                />
                <SortTh
                  label="Statut"
                  sortKey="status"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggle}
                />
                <SortTh
                  label="Fichier"
                  sortKey="filename"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggle}
                />
                <SortTh
                  label="Taille"
                  sortKey="size"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={toggle}
                />
                <th>Destination</th>
                <th>Erreur</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id}>
                  <td>{formatUtcLocal(b.startedAt)}</td>
                  <td>{TYPE_LABEL[b.type]}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="mono">{b.filename || '—'}</td>
                  <td>{formatSize(b.size)}</td>
                  <td className="mono">{b.destination || '—'}</td>
                  <td>{b.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>

        {pages > 1 ? (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
              marginTop: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn btn-soft"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </button>
            <span className="muted">
              Page {page} / {pages}
            </span>
            <button
              type="button"
              className="btn btn-soft"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Suivant
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
