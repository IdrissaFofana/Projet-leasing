'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTableShell, SortTh, useTableSort } from '@/components/DataTable';
import { Modal, ModalCloseButton, ModalSubmitButton } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { NamedRef, Tarif } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';

const SECTIONS = ['marques', 'fournisseurs', 'agents', 'services', 'tarifs'] as const;
type Section = (typeof SECTIONS)[number];

const TITLES: Record<Section, string> = {
  marques: 'Marques',
  fournisseurs: 'Fournisseurs',
  agents: 'Agents',
  services: 'Services',
  tarifs: 'Tarifs',
};

const SINGULAR: Record<Exclude<Section, 'tarifs'>, string> = {
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
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const section = isSection(params.section) ? params.section : null;

  const [items, setItems] = useState<NamedRef[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [nom, setNom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const itemsSort = useTableSort<NamedRef>('nom');
  const tarifsSort = useTableSort<Tarif>('libelle');

  useEffect(() => {
    if (!section) router.replace('/referentiels/marques');
  }, [section, router]);

  async function load(current: Section) {
    setLoading(true);
    setError(null);
    try {
      if (current === 'tarifs') setTarifs(await api.tarifs.list());
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
    if (!section || section === 'tarifs' || !nom.trim()) return;
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
        <p className="form-error">Accès réservé aux administrateurs</p>
      </div>
    );
  }

  if (!section) return null;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <h1>{TITLES[section]}</h1>
          <p>Référentiels et paramètres leasing</p>
        </div>
        {section !== 'tarifs' ? (
          <button
            type="button"
            className="btn btn-esay"
            onClick={() => {
              setNom('');
              setError(null);
              setOpen(true);
            }}
          >
            + Ajouter
          </button>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="msg-ok">{ok}</p> : null}

      <Modal
        open={open && section !== 'tarifs'}
        eyebrow="NOUVEAU"
        title={`Nouveau ${SINGULAR[section as Exclude<Section, 'tarifs'>] ?? 'élément'}`}
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
                placeholder={`Nom du ${SINGULAR[section as Exclude<Section, 'tarifs'>] ?? 'élément'}…`}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
        </form>
      </Modal>

      {section !== 'tarifs' ? (
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
