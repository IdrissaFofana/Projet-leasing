'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CrudPermissionsEditor } from '@/components/CrudPermissionsEditor';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  allPermissionKeys,
  normalizePermissions,
  permissionKey,
  type PermissionKey,
} from '@/lib/permissions';
import type { ManagedUser, RoleMetier } from '@/lib/types';

type RoleForm = {
  code: string;
  libelle: string;
  description: string;
  permissions: PermissionKey[];
  actif: boolean;
};

const DEFAULT_ROLE_PERMS: PermissionKey[] = [
  permissionKey('dashboard', 'read'),
  permissionKey('messages', 'read'),
  permissionKey('messages', 'create'),
];

const emptyRole = (): RoleForm => ({
  code: '',
  libelle: '',
  description: '',
  permissions: DEFAULT_ROLE_PERMS,
  actif: true,
});

function countPermissions(perms: string[] | undefined): number {
  return normalizePermissions(perms ?? []).length;
}

export default function RolesPermissionsPage() {
  const { confirm } = useFeedback();
  const { refreshUser } = useAuth();
  const [roles, setRoles] = useState<RoleMetier[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleMetier | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRole());
  const [savingRole, setSavingRole] = useState(false);

  const [permsOpen, setPermsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<PermissionKey[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<ManagedUser | null>(null);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const rolesSort = useTableSort<RoleMetier>('libelle', 'asc');
  const usersSort = useTableSort<ManagedUser>('nom', 'asc');

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  async function load() {
    setLoading(true);
    const [r, u] = await Promise.all([api.roles.list(), api.users.list()]);
    setRoles(r);
    setUsers(u);
    return r;
  }

  useEffect(() => {
    void load()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPermissions(r: RoleMetier) {
    setSelectedId(r.id);
    setDraftPerms(
      r.code === 'ADMIN'
        ? allPermissionKeys()
        : normalizePermissions(r.permissions ?? []),
    );
    setPermsOpen(true);
    setOk(null);
    setError(null);
  }

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm(emptyRole());
    setRoleOpen(true);
    setError(null);
    setOk(null);
  }

  function openEditRole(r: RoleMetier) {
    setEditingRole(r);
    setRoleForm({
      code: r.code,
      libelle: r.libelle,
      description: r.description ?? '',
      permissions:
        r.code === 'ADMIN'
          ? allPermissionKeys()
          : normalizePermissions(r.permissions ?? []),
      actif: r.actif,
    });
    setRoleOpen(true);
    setError(null);
    setOk(null);
  }

  async function savePermissions() {
    if (!selected || selected.code === 'ADMIN') return;
    setSavingPerms(true);
    setError(null);
    setOk(null);
    try {
      await api.roles.update(selected.id, { permissions: draftPerms });
      setOk(
        `Permissions du rôle « ${selected.libelle} » enregistrées (${draftPerms.length} droit(s)). Les utilisateurs liés sont mis à jour.`,
      );
      await load();
      setPermsOpen(false);
      await refreshUser().catch(() => null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSavingPerms(false);
    }
  }

  async function submitRole(e: FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    setError(null);
    setOk(null);
    try {
      if (editingRole) {
        await api.roles.update(editingRole.id, {
          libelle: roleForm.libelle.trim(),
          description: roleForm.description.trim() || null,
          permissions:
            editingRole.code === 'ADMIN' ? allPermissionKeys() : roleForm.permissions,
          actif: roleForm.actif,
        });
        setOk(`Rôle « ${roleForm.libelle} » mis à jour`);
      } else {
        await api.roles.create({
          code: roleForm.code.trim().toUpperCase(),
          libelle: roleForm.libelle.trim(),
          description: roleForm.description.trim() || undefined,
          permissions: roleForm.permissions,
        });
        setOk(`Rôle « ${roleForm.libelle} » créé`);
      }
      setRoleOpen(false);
      await load();
      await refreshUser().catch(() => null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSavingRole(false);
    }
  }

  async function deleteRole(r: RoleMetier) {
    if (r.systeme) return;
    if (
      !(await confirm({
        title: 'Confirmation',
        message: `Supprimer le rôle « ${r.libelle} » ?`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    )
      return;
    setError(null);
    try {
      await api.roles.remove(r.id);
      setOk(`Rôle « ${r.libelle} » supprimé`);
      if (selectedId === r.id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  function openAssign(u: ManagedUser) {
    setAssignUser(u);
    setAssignRoleId(u.roleMetierId ?? roles.find((r) => r.code === u.role)?.id ?? '');
    setAssignOpen(true);
    setError(null);
    setOk(null);
  }

  async function submitAssign(e: FormEvent) {
    e.preventDefault();
    if (!assignUser || !assignRoleId) return;
    setSavingAssign(true);
    setError(null);
    try {
      await api.users.update(assignUser.id, { roleMetierId: assignRoleId });
      setOk(`Rôle attribué à ${assignUser.nom}`);
      setAssignOpen(false);
      await load();
      await refreshUser().catch(() => null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Attribution impossible');
    } finally {
      setSavingAssign(false);
    }
  }

  const sortedRoles = useMemo(
    () =>
      rolesSort.sort(roles, (row, key) => {
        if (key === 'code') return row.code;
        if (key === 'users') return row._count?.utilisateurs ?? 0;
        return row.libelle;
      }),
    [roles, rolesSort],
  );

  const sortedUsers = useMemo(
    () =>
      usersSort.sort(users, (row, key) => {
        if (key === 'email') return row.email;
        if (key === 'role') return row.roleMetier?.libelle ?? row.role;
        return row.nom;
      }),
    [users, usersSort],
  );

  const normalizedSelected = selected
    ? normalizePermissions(selected.permissions ?? [])
    : [];
  const dirty =
    selected &&
    selected.code !== 'ADMIN' &&
    JSON.stringify([...draftPerms].sort()) !==
      JSON.stringify([...normalizedSelected].sort());

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>Rôles & permissions</h1>
          <p>
            Créez des rôles, définissez les droits CRUD par module, puis attribuez le rôle aux
            utilisateurs
          </p>
        </div>
        <button type="button" className="btn btn-esay" onClick={openCreateRole}>
          + Nouveau rôle
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

      <section className="panel anim-section" style={{ marginBottom: '1.25rem' }}>
        <h2>Catalogue des rôles</h2>
        <p className="muted" style={{ marginBottom: '0.75rem' }}>
          Cliquez sur Permissions pour ajuster lecture, création, modification et suppression par
          module.
        </p>
        <DataTableShell loading={loading} empty={!loading && roles.length === 0} emptyMessage="Aucun rôle">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh
                  label="Libellé"
                  sortKey="libelle"
                  activeKey={rolesSort.sortKey}
                  direction={rolesSort.sortDir}
                  onSort={rolesSort.toggle}
                />
                <SortTh
                  label="Code"
                  sortKey="code"
                  activeKey={rolesSort.sortKey}
                  direction={rolesSort.sortDir}
                  onSort={rolesSort.toggle}
                />
                <th>Droits</th>
                <SortTh
                  label="Users"
                  sortKey="users"
                  activeKey={rolesSort.sortKey}
                  direction={rolesSort.sortDir}
                  onSort={rolesSort.toggle}
                />
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {sortedRoles.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.libelle}
                    {r.systeme ? (
                      <span className="badge badge-info" style={{ marginLeft: 6 }}>
                        Système
                      </span>
                    ) : null}
                  </td>
                  <td className="mono">{r.code}</td>
                  <td>
                    {r.code === 'ADMIN'
                      ? 'Tous'
                      : countPermissions(r.permissions)
                        ? `${countPermissions(r.permissions)} droit(s)`
                        : 'Aucun'}
                  </td>
                  <td>{r._count?.utilisateurs ?? 0}</td>
                  <td className="col-actions">
                    <button type="button" className="btn btn-soft" onClick={() => openPermissions(r)}>
                      Permissions
                    </button>{' '}
                    <button type="button" className="btn btn-soft" onClick={() => openEditRole(r)}>
                      Infos
                    </button>{' '}
                    {!r.systeme ? (
                      <button type="button" className="btn btn-soft" onClick={() => void deleteRole(r)}>
                        Supprimer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </section>

      <section className="panel anim-section">
        <h2>Attribution aux utilisateurs</h2>
        <DataTableShell loading={loading} empty={!loading && users.length === 0} emptyMessage="Aucun utilisateur">
          <table className="data-table">
            <thead>
              <tr>
                <SortTh
                  label="Nom"
                  sortKey="nom"
                  activeKey={usersSort.sortKey}
                  direction={usersSort.sortDir}
                  onSort={usersSort.toggle}
                />
                <SortTh
                  label="Email"
                  sortKey="email"
                  activeKey={usersSort.sortKey}
                  direction={usersSort.sortDir}
                  onSort={usersSort.toggle}
                />
                <SortTh
                  label="Rôle actuel"
                  sortKey="role"
                  activeKey={usersSort.sortKey}
                  direction={usersSort.sortDir}
                  onSort={usersSort.toggle}
                />
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.nom}</td>
                  <td className="mono">{u.email}</td>
                  <td>
                    <span className="badge badge-info">
                      {u.roleMetier?.libelle ?? u.role}
                    </span>
                  </td>
                  <td className="col-actions">
                    <button type="button" className="btn btn-soft" onClick={() => openAssign(u)}>
                      Attribuer un rôle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      </section>

      <Modal
        open={roleOpen}
        wide
        eyebrow={editingRole ? 'MODIFIER' : 'NOUVEAU'}
        title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
        subtitle="Définissez le libellé et les droits CRUD dès la création."
        onClose={() => setRoleOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setRoleOpen(false)} label="Annuler" />
            <ModalSubmitButton form="role-form" disabled={savingRole}>
              {savingRole ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="role-form" className="modal-form" onSubmit={submitRole}>
          {!editingRole ? (
            <div className="modal-form-row">
              <label>Code</label>
              <div className="modal-field">
                <input
                  className="modal-input"
                  required
                  placeholder="SUPERVISEUR"
                  value={roleForm.code}
                  onChange={(e) =>
                    setRoleForm({ ...roleForm, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="modal-form-row">
              <label>Code</label>
              <div className="modal-field">
                <code className="mono">{roleForm.code}</code>
              </div>
            </div>
          )}
          <div className="modal-form-row">
            <label>Libellé</label>
            <div className="modal-field">
              <input
                className="modal-input"
                required
                value={roleForm.libelle}
                onChange={(e) => setRoleForm({ ...roleForm, libelle: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-form-row is-top">
            <label>Description</label>
            <div className="modal-field">
              <textarea
                className="modal-textarea"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </div>
          </div>
          {editingRole && !editingRole.systeme ? (
            <div className="modal-form-row">
              <label>Actif</label>
              <div className="modal-field">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={roleForm.actif}
                    onChange={(e) => setRoleForm({ ...roleForm, actif: e.target.checked })}
                  />
                  Rôle actif
                </label>
              </div>
            </div>
          ) : null}
          <div className="modal-form-row is-top">
            <label>Droits CRUD</label>
            <div className="modal-field">
              {editingRole?.code === 'ADMIN' ? (
                <p className="muted">Administrateur : accès complet.</p>
              ) : (
                <CrudPermissionsEditor
                  value={roleForm.permissions}
                  onChange={(permissions) => setRoleForm((f) => ({ ...f, permissions }))}
                />
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={permsOpen && !!selected}
        wide
        eyebrow="PERMISSIONS"
        title={selected ? `Permissions — ${selected.libelle}` : 'Permissions'}
        subtitle="Cochez les actions autorisées (lecture, création, modification, suppression) pour chaque module."
        onClose={() => {
          setPermsOpen(false);
          setSelectedId(null);
        }}
        footer={
          <>
            <ModalCloseButton
              onClick={() => {
                setPermsOpen(false);
                setSelectedId(null);
              }}
              label="Fermer"
            />
            {selected && selected.code !== 'ADMIN' ? (
              <button
                type="button"
                className="btn-modal btn-modal-primary"
                disabled={savingPerms || !dirty}
                onClick={() => void savePermissions()}
              >
                {savingPerms ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            ) : null}
          </>
        }
      >
        {selected?.code === 'ADMIN' ? (
          <p className="muted">
            Administrateur : tous les droits sur tous les modules (non modifiable).
          </p>
        ) : (
          <>
            <CrudPermissionsEditor
              value={draftPerms}
              onChange={setDraftPerms}
            />
            {dirty ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Modifications non enregistrées.
              </p>
            ) : null}
          </>
        )}
      </Modal>

      <Modal
        open={assignOpen}
        eyebrow="ATTRIBUTION"
        title={assignUser ? `Rôle — ${assignUser.nom}` : 'Attribuer'}
        subtitle="Le rôle applique automatiquement ses droits CRUD."
        onClose={() => setAssignOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setAssignOpen(false)} label="Annuler" />
            <ModalSubmitButton form="assign-form" disabled={savingAssign || !assignRoleId}>
              {savingAssign ? 'Enregistrement…' : 'Attribuer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="assign-form" className="modal-form" onSubmit={submitAssign}>
          <div className="modal-form-row">
            <label>Rôle</label>
            <div className="modal-field">
              <select
                className="modal-select"
                required
                value={assignRoleId}
                onChange={(e) => setAssignRoleId(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {roles
                  .filter((r) => r.actif)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.libelle} ({r.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
