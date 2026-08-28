'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTableShell, SortTh, TableActions, useTableSort } from '@/components/DataTable';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { ClientRef, NamedRef, Tarif } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const SECTIONS = ['marques', 'fournisseurs', 'agents', 'services', 'clients', 'tarifs'] as const;
type Section = (typeof SECTIONS)[number];

const TITLES: Record<Section, string> = {
  marques: 'Marques',
  fournisseurs: 'Fournisseurs',
  agents: 'Agents',
  services: 'Services',
  clients: 'Clients',
  tarifs: 'Tarifs',
};

const SINGULAR: Record<Exclude<Section, 'tarifs' | 'clients'>, string> = {
  marques: 'marque',
  fournisseurs: 'fournisseur',
  agents: 'agent',
  services: 'service',
};

function isSection(v: string): v is Section {
  return (SECTIONS as readonly string[]).includes(v);
}

export default function ReferentielSectionPage() {
  const { user } = useAuth();
  const { confirm } = useFeedback();
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const section = isSection(params.section) ? params.section : null;

  const [items, setItems] = useState<NamedRef[]>([]);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [clientActif, setClientActif] = useState(true);
  const [editingClient, setEditingClient] = useState<ClientRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const itemsSort = useTableSort<NamedRef>('nom');
  const clientsSort = useTableSort<ClientRef>('nom');
  const tarifsSort = useTableSort<Tarif>('libelle');

  useEffect(() => {
    if (!section) router.replace('/referentiels/marques');
  }, [section, router]);

  async function load(current: Section) {
    setLoading(true);
    setError(null);
    try {
      if (current === 'tarifs') setTarifs(await api.tarifs.list());
      else if (current === 'clients') setClients(await api.clients.list());
      else if (current === 'marques') setItems(await api.marques.list());
      else if (current === 'fournisseurs') setItems(await api.fournisseurs.list());
      else if (current === 'agents') setItems(await api.agents.list());
      else setItems(await api.services.list());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (section) void load(section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  async function createNamed(e: FormEvent) {
    e.preventDefault();
    if (!section || section === 'tarifs' || section === 'clients' || !nom.trim()) return;
    setOk(null);
    setError(null);
    setSaving(true);
    try {
      if (section === 'marques') await api.marques.create(nom.trim());
      else if (section === 'fournisseurs') await api.fournisseurs.create(nom.trim());
      else if (section === 'agents') await api.agents.create(nom.trim());
      else await api.services.create(nom.trim());
      setNom('');
      setOk('Ajouté');
      setOpen(false);
      await load(section);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible');
    } finally {
      setSaving(false);
    }
  }

  async function createClient(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setOk(null);
    setError(null);
    setSaving(true);
    try {
      if (editingClient) {
        await api.clients.update(editingClient.id, {
          nom: nom.trim(),
          telephone: telephone.trim() || null,
          email: email.trim() || null,
          actif: clientActif,
        });
        setOk(`Client « ${nom.trim()} » mis à jour`);
      } else {
        await api.clients.create({
          nom: nom.trim(),
          telephone: telephone.trim() || undefined,
          email: email.trim() || undefined,
        });
        setOk('Client ajouté');
      }
      setNom('');
      setTelephone('');
      setEmail('');
      setClientActif(true);
      setEditingClient(null);
      setOpen(false);
      await load('clients');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  function openCreateClient() {
    setEditingClient(null);
    setNom('');
    setTelephone('');
    setEmail('');
    setClientActif(true);
    setError(null);
    setOpen(true);
  }

  function openEditClient(c: ClientRef) {
    setEditingClient(c);
    setNom(c.nom);
    setTelephone(c.telephone ?? '');
    setEmail(c.email ?? '');
    setClientActif(c.actif !== false);
    setError(null);
    setOk(null);
    setOpen(true);
  }

  async function deleteClient(c: ClientRef) {
    if (
      !(await confirm({
        title: 'Supprimer le client',
        message: `Supprimer « ${c.nom} » ? Les lignes stock liées garderont le nom destinataire mais ne seront plus rattachées au client.`,
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    ) {
      return;
    }
    setError(null);
    try {
      const res = await api.clients.remove(c.id);
      setOk(
        res.unlinked > 0
          ? `Client « ${c.nom} » supprimé (${res.unlinked} ligne(s) stock détachée(s))`
          : `Client « ${c.nom} » supprimé`,
      );
      await load('clients');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  async function saveTarif(t: Tarif, prix: string) {
    setError(null);
    try {
      await api.tarifs.update(t.id, { prixUnitaire: Number(prix) });
      setOk(`Tarif ${t.libelle} mis à jour`);
      await load('tarifs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  const sortedItems = useMemo(
    () =>
      itemsSort.sort(items, (row, key) => {
        if (key === 'nom') return row.nom;
        if (key === 'actif') return row.actif === false ? 0 : 1;
        return '';
      }),
    [items, itemsSort],
  );

  const sortedClients = useMemo(
    () =>
      clientsSort.sort(clients, (row, key) => {
        if (key === 'nom') return row.nom;
        if (key === 'telephone') return row.telephone ?? '';
        if (key === 'email') return row.email ?? '';
        if (key === 'actif') return row.actif === false ? 0 : 1;
        return '';
      }),
    [clients, clientsSort],
  );

  const sortedTarifs = useMemo(
    () =>
      tarifsSort.sort(tarifs, (row, key) => {
        if (key === 'libelle') return row.libelle;
        if (key === 'type') return row.type;
        if (key === 'prix') return Number(row.prixUnitaire);
        return '';
      }),
    [tarifs, tarifsSort],
  );

  if (user?.role !== 'ADMIN') {
    return (
      <div className="page-head">
        <h1>Référentiels</h1>
        <PageFeedback
          error="Accès réservé aux administrateurs"
          onDismiss={() => {}}
        />
      </div>
    );
  }

  if (!section) return null;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>{TITLES[section]}</h1>
          <p>
            {section === 'clients'
              ? 'Clients destinataires pour les sorties stock produits'
              : 'Référentiels et paramètres leasing'}
          </p>
        </div>
        {section !== 'tarifs' ? (
          <button
            type="button"
            className="btn btn-esay"
            onClick={() => {
              if (section === 'clients') {
                openCreateClient();
                return;
              }
              setNom('');
              setTelephone('');
              setEmail('');
              setError(null);
              setOpen(true);
            }}
          >
            + Ajouter
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

      <Modal
        open={open && section !== 'tarifs' && section !== 'clients'}
        eyebrow="NOUVEAU"
        title={`Nouveau ${SINGULAR[section as Exclude<Section, 'tarifs' | 'clients'>] ?? 'élément'}`}
        subtitle="Ajoutez un élément au référentiel avec son nom."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ModalCloseButton onClick={() => setOpen(false)} label="Annuler" />
            <ModalSubmitButton form="referentiel-form" disabled={saving}>
              {saving ? 'Ajout…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="referentiel-form" className="modal-form" onSubmit={createNamed}>
          <div className="modal-form-row">
            <label>Nom</label>
            <div className="modal-field">
              <input
                className="modal-input"
                placeholder={`Nom du ${SINGULAR[section as Exclude<Section, 'tarifs' | 'clients'>] ?? 'élément'}…`}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={open && section === 'clients'}
        eyebrow={editingClient ? 'MODIFIER' : 'NOUVEAU'}
        title={editingClient ? `Modifier — ${editingClient.nom}` : 'Nouveau client'}
        subtitle="Nom obligatoire — téléphone et e-mail facultatifs."
        onClose={() => {
          setOpen(false);
          setEditingClient(null);
        }}
        footer={
          <>
            <ModalCloseButton
              onClick={() => {
                setOpen(false);
                setEditingClient(null);
              }}
              label="Annuler"
            />
            <ModalSubmitButton form="client-form" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="client-form" className="modal-form" onSubmit={createClient}>
          <div className="modal-form-row">
            <label>Nom</label>
            <div className="modal-field">
              <input
                className="modal-input"
                placeholder="Raison sociale ou nom…"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>Téléphone</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="tel"
                placeholder="Optionnel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-form-row">
            <label>E-mail</label>
            <div className="modal-field">
              <input
                className="modal-input"
                type="email"
                placeholder="Optionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {editingClient ? (
            <div className="modal-form-row">
              <label>Actif</label>
              <div className="modal-field">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={clientActif}
                    onChange={(e) => setClientActif(e.target.checked)}
                  />
                  Client actif (sélectionnable dans les sorties)
                </label>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>

      {section === 'clients' ? (
        <DataTableShell loading={loading} empty={!loading && clients.length === 0}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Nom" sortKey="nom" activeKey={clientsSort.sortKey} direction={clientsSort.sortDir} onSort={clientsSort.toggle} />
                <SortTh label="Téléphone" sortKey="telephone" activeKey={clientsSort.sortKey} direction={clientsSort.sortDir} onSort={clientsSort.toggle} />
                <SortTh label="E-mail" sortKey="email" activeKey={clientsSort.sortKey} direction={clientsSort.sortDir} onSort={clientsSort.toggle} />
                <SortTh label="Actif" sortKey="actif" activeKey={clientsSort.sortKey} direction={clientsSort.sortDir} onSort={clientsSort.toggle} />
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((it) => (
                <tr key={it.id}>
                  <td>{it.nom}</td>
                  <td>{it.telephone || '—'}</td>
                  <td>{it.email || '—'}</td>
                  <td>
                    <span className={it.actif === false ? 'badge badge-muted' : 'badge badge-ok'}>
                      {it.actif === false ? 'Non' : 'Oui'}
                    </span>
                  </td>
                  <td className="col-actions">
                    <TableActions
                      onEdit={() => openEditClient(it)}
                      onDelete={() => void deleteClient(it)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      ) : section !== 'tarifs' ? (
        <DataTableShell loading={loading} empty={!loading && items.length === 0}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Nom" sortKey="nom" activeKey={itemsSort.sortKey} direction={itemsSort.sortDir} onSort={itemsSort.toggle} />
                <SortTh label="Actif" sortKey="actif" activeKey={itemsSort.sortKey} direction={itemsSort.sortDir} onSort={itemsSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((it) => (
                <tr key={it.id}>
                  <td>{it.nom}</td>
                  <td>
                    <span className={it.actif === false ? 'badge badge-muted' : 'badge badge-ok'}>
                      {it.actif === false ? 'Non' : 'Oui'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      ) : (
        <DataTableShell loading={loading} empty={!loading && tarifs.length === 0}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh label="Libelle" sortKey="libelle" activeKey={tarifsSort.sortKey} direction={tarifsSort.sortDir} onSort={tarifsSort.toggle} />
                <SortTh label="Type" sortKey="type" activeKey={tarifsSort.sortKey} direction={tarifsSort.sortDir} onSort={tarifsSort.toggle} />
                <SortTh label="Prix" sortKey="prix" activeKey={tarifsSort.sortKey} direction={tarifsSort.sortDir} onSort={tarifsSort.toggle} />
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {sortedTarifs.map((t) => (
                <TarifRow key={t.id} tarif={t} onSave={saveTarif} />
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </>
  );
}

function TarifRow({
  tarif,
  onSave,
}: {
  tarif: Tarif;
  onSave: (t: Tarif, prix: string) => Promise<void>;
}) {
  const [prix, setPrix] = useState(String(tarif.prixUnitaire));
  return (
    <tr>
      <td>{tarif.libelle}</td>
      <td>{tarif.type}</td>
      <td>
        <input
          className="input"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          style={{ width: 120 }}
        />{' '}
        {formatMoney(tarif.prixUnitaire)}
      </td>
      <td>
        <button type="button" className="btn btn-soft" onClick={() => void onSave(tarif, prix)}>
          Sauver
        </button>
      </td>
    </tr>
  );
}
