'use client';

import { useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { api, ApiError } from '@/lib/api';
import type { ManagedUser } from '@/lib/types';

export default function MotsDePassePage() {
  const { confirm, showAlert } = useFeedback();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { sortKey, sortDir, toggle, sort } = useTableSort<ManagedUser>('nom', 'asc');

  async function load() {
    setRows(await api.users.list());
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, []);

  async function resetPassword(u: ManagedUser) {
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Régénérer un mot de passe temporaire pour ${u.nom} ? L’utilisateur devra le redéfinir à la prochaine connexion.`,
        danger: true,
        confirmLabel: 'Régénérer',
      }))
    ) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    setOk(null);
    try {
      const res = await api.users.resetPassword(u.id);
      if (res.temporaryPassword) {
        showAlert({
          variant: 'success',
          title: 'Mot de passe temporaire',
          message: `Mot de passe temporaire : ${res.temporaryPassword} (changement obligatoire à la 1ʳᵉ connexion)`,
        });
      }
      setOk(
        `Mot de passe régénéré pour ${u.nom}. Communiquez-le de façon sécurisée — redéfinition obligatoire à la connexion.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réinitialisation impossible');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'email') return row.email;
        if (key === 'role') return row.role;
        return row.nom;
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head">
        <h1>Réinitialisation des mots de passe</h1>
        <p>
          Un mot de passe temporaire est généré. À la connexion avec ce mot de passe, le système
          force la redéfinition.
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

      <DataTableShell empty={rows.length === 0} emptyMessage="Aucun utilisateur">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Nom" sortKey="nom" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Email" sortKey="email" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Rôle" sortKey="role" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th>État MDP</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id}>
                <td>{u.nom}</td>
                <td className="mono">{u.email}</td>
                <td>
                  <span className="badge badge-info">{u.role}</span>
                </td>
                <td>
                  {u.mustChangePassword ? (
                    <span className="badge badge-warn">À redéfinir</span>
                  ) : (
                    <span className="badge badge-info">OK</span>
                  )}
                </td>
                <td className="col-actions">
                  <button
                    type="button"
                    className="btn btn-esay"
                    disabled={!u.actif || busyId === u.id}
                    onClick={() => void resetPassword(u)}
                  >
                    {busyId === u.id ? 'Génération…' : 'Réinitialiser'}
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
