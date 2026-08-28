'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState<string | null>(null);
  const { sortKey, sortDir, toggle, sort } = useTableSort<AppNotification>('createdAt', 'desc');

  async function load() {
    setLoading(true);
    try {
      const list = await api.notifications.sync().catch(() => api.notifications.list(100));
      setRows(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  async function markAll() {
    setError(null);
    try {
      await api.notifications.markAllRead();
      setOk('Toutes les notifications ont été marquées comme lues');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  async function openNotif(n: AppNotification) {
    if (!n.luAt) {
      try {
        await api.notifications.markRead(n.id);
        setRows((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, luAt: new Date().toISOString() } : x)),
        );
      } catch {
        /* ignore */
      }
    }
  }

  const sorted = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'titre') return row.titre;
        if (key === 'type') return row.type;
        if (key === 'priority') return row.priority;
        return row.createdAt;
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Notifications</h1>
          <p>Toutes vos alertes et messages système</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={() => void markAll()}>
          Tout marquer comme lu
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

      <DataTableShell
        loading={loading}
        empty={!loading && rows.length === 0}
        emptyMessage="Aucune notification"
      >
        <table className="data-table">
          <thead>
            <tr>
              <SortTh
                label="Date"
                sortKey="createdAt"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
              <SortTh
                label="Titre"
                sortKey="titre"
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
              <th>Message</th>
              <th>Statut</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((n) => (
              <tr key={n.id} className={n.luAt ? undefined : 'is-unread-row'}>
                <td className="mono">{formatWhen(n.createdAt)}</td>
                <td>
                  <strong>{n.titre}</strong>
                </td>
                <td>
                  <span className="badge badge-info">{n.type}</span>
                </td>
                <td>{n.message}</td>
                <td>{n.luAt ? 'Lue' : 'Non lue'}</td>
                <td className="col-actions">
                  {n.lien ? (
                    <Link
                      href={n.lien}
                      className="btn btn-soft"
                      onClick={() => void openNotif(n)}
                    >
                      Ouvrir
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-soft"
                      onClick={() => void openNotif(n)}
                    >
                      Marquer lu
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </>
  );
}
