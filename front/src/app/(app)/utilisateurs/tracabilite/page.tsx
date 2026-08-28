'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import type { AuditEntry, ManagedUser } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILURE: 'Connexion échouée',
  PASSWORD_CHANGED: 'Mot de passe changé',
  PASSWORD_RESET: 'Réinitialisation MDP',
  USER_CREATE: 'Création utilisateur',
  USER_UPDATE: 'Modification utilisateur',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TracabilitePage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [entite, setEntite] = useState('');
  const [resultat, setResultat] = useState('');
  const { sortKey, sortDir, toggle, sort } = useTableSort<AuditEntry>('dateHeure', 'desc');

  async function load(filters?: {
    userId?: string;
    action?: string;
    entite?: string;
    resultat?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const [logs, list] = await Promise.all([
        api.audit.recent({
          limit: 200,
          userId: filters?.userId || undefined,
          action: filters?.action || undefined,
          entite: filters?.entite || undefined,
          resultat: filters?.resultat || undefined,
        }),
        users.length ? Promise.resolve(users) : api.users.list(),
      ]);
      setRows(logs);
      if (!users.length) setUsers(list);
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

  function onFilter(e: FormEvent) {
    e.preventDefault();
    void load({ userId, action, entite, resultat });
  }

  const sorted = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'action') return row.action;
        if (key === 'acteur') return row.user?.nom ?? '';
        if (key === 'entite') return row.entite ?? '';
        if (key === 'resultat') return row.resultat ?? '';
        return row.dateHeure;
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head">
        <h1>Traçabilité</h1>
        <p>
          Journal d’audit pour la non-répudiation : qui a fait quoi, quand, depuis quelle IP.
        </p>
      </div>

      <PageFeedback error={error} onDismiss={() => setError(null)} />

      <form className="panel" style={{ marginBottom: '1rem' }} onSubmit={onFilter}>
        <div className="form-grid">
          <label>
            Acteur
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Tous</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            Action
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="LOGIN, USER_CREATE…"
            />
          </label>
          <label>
            Entité
            <input
              value={entite}
              onChange={(e) => setEntite(e.target.value)}
              placeholder="utilisateur, auth, printers…"
            />
          </label>
          <label>
            Résultat
            <select value={resultat} onChange={(e) => setResultat(e.target.value)}>
              <option value="">Tous</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-esay" disabled={loading}>
            {loading ? 'Chargement…' : 'Filtrer'}
          </button>
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => {
              setUserId('');
              setAction('');
              setEntite('');
              setResultat('');
              void load({});
            }}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      <DataTableShell empty={!loading && rows.length === 0} emptyMessage="Aucun événement">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh
                label="Date / heure"
                sortKey="dateHeure"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
              <SortTh
                label="Acteur"
                sortKey="acteur"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
              <SortTh
                label="Action"
                sortKey="action"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
              <SortTh
                label="Entité"
                sortKey="entite"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
              <th>Détails</th>
              <th>IP</th>
              <SortTh
                label="Résultat"
                sortKey="resultat"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggle}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatWhen(r.dateHeure)}</td>
                <td>
                  {r.user ? (
                    <>
                      {r.user.nom}
                      <div className="muted mono" style={{ fontSize: '0.8rem' }}>
                        {r.user.email}
                      </div>
                    </>
                  ) : (
                    <span className="muted">Système / anonyme</span>
                  )}
                </td>
                <td>
                  <span className="badge badge-info">
                    {ACTION_LABELS[r.action] ?? r.action}
                  </span>
                </td>
                <td>
                  {r.entite ?? '—'}
                  {r.entiteId ? (
                    <div className="muted mono" style={{ fontSize: '0.75rem' }}>
                      {r.entiteId}
                    </div>
                  ) : null}
                </td>
                <td>{r.details ?? '—'}</td>
                <td className="mono">{r.ipAdresse ?? '—'}</td>
                <td>
                  {r.resultat === 'FAILURE' ? (
                    <span className="badge badge-warn">FAILURE</span>
                  ) : (
                    <span className="badge badge-info">{r.resultat ?? 'SUCCESS'}</span>
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
