'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ManagedUser, RoleMetier } from '@/lib/types';

type FormState = {
  nom: string;
  email: string;
  roleMetierId: string;
  actif: boolean;
};

const emptyForm = (roleMetierId = ''): FormState => ({
  nom: '',
  email: '',
  roleMetierId,
  actif: true,
});

export default function ComptesUtilisateursPage() {
  const { user: currentUser } = useAuth();
  const { confirm, showAlert } = useFeedback();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleMetier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm());
  const { sortKey, sortDir, toggle, sort } = useTableSort<ManagedUser>('nom', 'asc');

  async function load() {
    const [users, roleList] = await Promise.all([api.users.list(), api.roles.list()]);
    setRows(users);
    setRoles(roleList.filter((r) => r.actif));
  }

  useEffect(() => {
    void load()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);

  function defaultRoleId() {
    return (
      roles.find((r) => r.code === 'TECHNICIEN')?.id ||
      roles[0]?.id ||
      ''
    );
  }

  function openCreate() {
    setEditing(null);
    setError(null);
    setOk(null);
    setForm(emptyForm(defaultRoleId()));
    setOpen(true);
  }

  function openEdit(u: ManagedUser) {
    setEditing(u);
    setError(null);
    setOk(null);
    setForm({
      nom: u.nom,
      email: u.email,
      roleMetierId: u.roleMetierId ?? roles.find((r) => r.code === u.role)?.id ?? '',
      actif: u.actif,
    });
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (editing) {
        await api.users.update(editing.id, {
          nom: form.nom.trim(),
          email: form.email.trim().toLowerCase(),
          roleMetierId: form.roleMetierId || undefined,
          actif: form.actif,
        });
        setOk(`Compte ${form.nom} mis à jour`);
        setOpen(false);
      } else {
        const created = await api.users.create({
          nom: form.nom.trim(),
          email: form.email.trim().toLowerCase(),
          roleMetierId: form.roleMetierId || undefined,
        });
        setOk(`${created.nom} créé`);
        if (created.generatedPassword) {
          showAlert({
            variant: 'success',
            title: 'Compte créé',
            message: `Mot de passe initial : ${created.email} (identique à l'adresse email). L'utilisateur devra le changer à la première connexion.`,
          });
        }
        setOpen(false);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(u: ManagedUser) {
    if (
      !(await confirm({
        title: 'Réinitialiser le mot de passe',
        message: `Le mot de passe de ${u.nom} sera remis à son adresse email (${u.email}). Un changement sera demandé à la prochaine connexion.`,
        confirmLabel: 'Réinitialiser',
      }))
    ) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    setOk(null);
    try {
      const res = await api.users.resetPassword(u.id);
      showAlert({
        variant: 'success',
        title: 'Mot de passe réinitialisé',
        message: `Nouveau mot de passe : ${res.email} (identique à l'email de connexion).`,
      });
      setOk(`Mot de passe réinitialisé pour ${u.nom}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réinitialisation impossible');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAccount(u: ManagedUser) {
    if (currentUser?.id === u.id) {
      setError('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    if (
      !(await confirm({
        title: 'Supprimer le compte',
        message: `Supprimer définitivement le compte de ${u.nom} (${u.email}) ? Cette action est irréversible.`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    setOk(null);
    try {
      await api.users.remove(u.id);
      setOk(`Compte ${u.nom} supprimé`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = useMemo(
    () =>
      sort(rows, (row, key) => {
        if (key === 'email') return row.email;
        if (key === 'role') return row.roleMetier?.libelle ?? row.role;
        if (key === 'actif') return row.actif ? 1 : 0;
        return row.nom;
      }),
    [rows, sort],
  );

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Comptes utilisateurs</h1>
          <p>Création, modification, réinitialisation MDP et suppression des comptes</p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openCreate}>
          + Nouvel utilisateur
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

      <Modal
        open={open}
        eyebrow={editing ? 'MODIFIER' : 'NOUVEAU'}
        title={editing ? 'Modifier le compte' : 'Nouveau compte'}
        subtitle={
          editing
            ? 'Vous pouvez modifier l’email de connexion, le rôle et le statut du compte.'
            : 'Le mot de passe initial est l\'adresse email. Un changement sera demandé à la première connexion.'
        }
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Fermer" />
            <ModalSubmitButton form="compte-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="compte-form" className="modal-form" onSubmit={onSubmit}>
          <div className="modal-form-row">
            <label>Nom</label>
            <div className="modal-field">
              <input
                className="modal-input"
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Email de connexion</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Rôle</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={form.roleMetierId}
                onChange={(e) => setForm({ ...form, roleMetierId: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.libelle} ({r.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {editing ? (
            <div className="modal-form-row">
              <label>Actif</label>
              <div className="modal-field">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.actif}
                    onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                  />
                  Compte actif
                </label>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>

      <DataTableShell loading={loading} empty={!loading && rows.length === 0} emptyMessage="Aucun compte">
        <table className="data-table">
          <thead>
            <tr>
              <SortTh label="Nom" sortKey="nom" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Email" sortKey="email" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Rôle" sortKey="role" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <SortTh label="Statut" sortKey="actif" activeKey={sortKey} direction={sortDir} onSort={toggle} />
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.id}>
                <td>{u.nom}</td>
                <td className="mono">{u.email}</td>
                <td>
                  <span className="badge badge-info">{u.roleMetier?.libelle ?? u.role}</span>
                </td>
                <td>
                  {u.actif ? 'Actif' : 'Inactif'}
                  {u.mustChangePassword ? (
                    <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                      MDP à changer
                    </span>
                  ) : null}
                </td>
                <td className="col-actions">
                  <button type="button" className="btn btn-soft" onClick={() => openEdit(u)}>
                    Modifier
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={!u.actif || busyId === u.id}
                    onClick={() => void resetPassword(u)}
                  >
                    {busyId === u.id ? '…' : 'Réinit. MDP'}
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={currentUser?.id === u.id || busyId === u.id}
                    onClick={() => void deleteAccount(u)}
                  >
                    Supprimer
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
