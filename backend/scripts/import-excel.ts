/**
 * Vide la base (sauf Utilisateur + RoleMetier) puis importe
 * « Gestion cartouche et imprimante.xlsx ».
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/import-excel.ts
 *   npx ts-node --transpile-only scripts/import-excel.ts "C:\\chemin\\fichier.xlsx"
 */
import {
  CouleurToner,
  EntiteSequence,
  MotifAffectation,
  PrismaClient,
  StatutFactureLigne,
  StatutFacturePeriode,
  StatutImprimante,
  StatutPose,
  StatutReleve,
  StatutStock,
  TypeTarif,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  computeReleve,
  computeStatutStock,
} from '../src/common/domain/calculs';

const prisma = new PrismaClient();

const DEFAULT_XLSX = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'Gestion cartouche et imprimante.xlsx',
);

type Matrix = unknown[][];

function sheetMatrix(wb: XLSX.WorkBook, name: string): Matrix {
  const sh = wb.Sheets[name];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sh, {
    header: 1,
    defval: null,
    raw: true,
  }) as Matrix;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const parsed = XLSX.SSF.parse_date_code(Number(s));
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function excelTime(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return new Date(
        Date.UTC(1899, 11, 30, parsed.H ?? 0, parsed.M ?? 0, Math.floor(parsed.S ?? 0)),
      );
    }
  }
  return null;
}

function normalizeBrand(nom: string) {
  const u = nom.trim();
  if (u.toUpperCase() === 'CANON') return 'Canon';
  return u;
}

function mapStatutImprimante(raw: string | null): StatutImprimante {
  const s = (raw ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (s.includes('maintenance')) return StatutImprimante.EN_MAINTENANCE;
  if (s.includes('hors')) return StatutImprimante.HORS_SERVICE;
  if (s.includes('retir')) return StatutImprimante.RETIREE;
  return StatutImprimante.FONCTIONNELLE;
}

function mapCouleur(raw: string | null): CouleurToner | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (s.includes('BLACK') || s.includes('NOIR')) return CouleurToner.TONER_BLACK;
  if (s.includes('CYAN')) return CouleurToner.TONER_CYAN;
  if (s.includes('MAGENTA')) return CouleurToner.TONER_MAGENTA;
  if (s.includes('YELLOW') || s.includes('JAUNE')) return CouleurToner.TONER_YELLOW;
  return null;
}

function mapMotif(raw: string | null): MotifAffectation | null {
  if (!raw) return null;
  const s = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (s.includes('remplacement')) return MotifAffectation.REMPLACEMENT_NORMAL;
  if (s.includes('vide')) return MotifAffectation.TONER_VIDE;
  if (s.includes('panne')) return MotifAffectation.PANNE_IMPRESSION;
  if (s.includes('test')) return MotifAffectation.TEST;
  if (s.includes('urgence')) return MotifAffectation.URGENCE;
  if (s.includes('maintenance')) return MotifAffectation.MAINTENANCE;
  return null;
}

function mapStatutReleve(raw: string | null, isFirst: boolean): StatutReleve {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('BASE')) return StatutReleve.BASE_INITIALE;
  if (s.includes('ANOMALIE')) return StatutReleve.ANOMALIE_COMPTEUR;
  if (s.includes('CONTROL')) return StatutReleve.A_CONTROLER;
  if (s.includes('VALID')) return StatutReleve.VALIDE;
  if (s.includes('OK')) return StatutReleve.OK;
  if (s.includes('SAISI')) return StatutReleve.SAISI;
  return isFirst ? StatutReleve.BASE_INITIALE : StatutReleve.OK;
}

function mapFactureLigneStatut(raw: string | null): StatutFactureLigne {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('AUCUNE')) return StatutFactureLigne.AUCUNE_FACTURE;
  if (s.includes('FACTUREE') || s.includes('FACTURÉE')) return StatutFactureLigne.FACTUREE;
  if (s.includes('ANNUL')) return StatutFactureLigne.ANNULEE;
  return StatutFactureLigne.A_FACTURER;
}

async function wipeExceptUsers() {
  console.log('→ Purge des données métier (users / rôles conservés)…');
  // Ordre respectant les FK
  await prisma.releveAudit.deleteMany();
  await prisma.messageInterne.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.factureLigne.deleteMany();
  await prisma.facturePeriode.deleteMany();
  await prisma.ligneSaisieMensuelle.deleteMany();
  await prisma.campagneSaisie.deleteMany();
  await prisma.affectationLigne.deleteMany();
  await prisma.affectation.deleteMany();
  await prisma.releveCompteur.deleteMany();
  await prisma.entreeStock.deleteMany();
  await prisma.cartoucheSku.deleteMany();
  await prisma.modeleCartouche.deleteMany();
  await prisma.imprimante.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.service.deleteMany();
  await prisma.marque.deleteMany();
  await prisma.fournisseur.deleteMany();
  await prisma.tarifLeasing.deleteMany();
  await prisma.idSequenceConfig.deleteMany();
  console.log('  purge OK');
}

async function upsertNamed(
  model: 'marque' | 'fournisseur' | 'agent' | 'service',
  nom: string,
) {
  const clean = nom.trim();
  if (!clean) throw new Error('nom vide');
  if (model === 'marque') {
    return prisma.marque.upsert({
      where: { nom: clean },
      update: { actif: true },
      create: { nom: clean },
    });
  }
  if (model === 'fournisseur') {
    return prisma.fournisseur.upsert({
      where: { nom: clean },
      update: { actif: true },
      create: { nom: clean },
    });
  }
  if (model === 'agent') {
    return prisma.agent.upsert({
      where: { nom: clean },
      update: { actif: true },
      create: { nom: clean },
    });
  }
  return prisma.service.upsert({
    where: { nom: clean },
    update: { actif: true },
    create: { nom: clean },
  });
}

async function importReferentiels(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Parametres');
  // Row 2 = headers, data from row 3
  const marques = new Set<string>();
  const fournisseurs = new Set<string>();
  const agents = new Set<string>();
  const services = new Set<string>();
  const tarifs: Partial<Record<TypeTarif, number>> = {};

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (str(r[5])) marques.add(normalizeBrand(str(r[5])!));
    if (str(r[6])) fournisseurs.add(str(r[6])!);
    if (str(r[7])) agents.add(str(r[7])!);
    if (str(r[4])) services.add(str(r[4])!);
    const tarifLabel = str(r[9])?.toLowerCase() ?? '';
    const prix = num(r[10]);
    if (tarifLabel.includes('n&b') || tarifLabel.includes('nb')) tarifs[TypeTarif.COPIE_NB] = prix;
    else if (tarifLabel.includes('couleur') && tarifLabel.includes('copie'))
      tarifs[TypeTarif.COPIE_COULEUR] = prix;
    else if (tarifLabel.includes('scan') && tarifLabel.includes('noir'))
      tarifs[TypeTarif.SCAN_NOIR] = prix;
    else if (tarifLabel.includes('scan') && tarifLabel.includes('couleur'))
      tarifs[TypeTarif.SCAN_COULEUR] = prix;
    else if (tarifLabel.includes('envoi')) tarifs[TypeTarif.ENVOI] = prix;
  }

  // Defaults if Parametres incomplete
  for (const n of ['HP', 'Canon', 'Epson', 'Brother', 'Ricoh', 'Kyocera', 'Xerox', 'Samsung']) {
    marques.add(n);
  }
  for (const n of ['ESAY Support', 'Mr Fofana', 'France', 'Stock interne']) {
    fournisseurs.add(n);
  }
  for (const n of ['Technicien ESAY', 'Agent 1', 'Agent 2', 'Responsable parc']) {
    agents.add(n);
  }

  for (const n of marques) await upsertNamed('marque', n);
  for (const n of fournisseurs) await upsertNamed('fournisseur', n);
  for (const n of agents) await upsertNamed('agent', n);
  for (const n of services) await upsertNamed('service', n);

  const tarifDefs: Array<{ type: TypeTarif; libelle: string; def: number }> = [
    { type: TypeTarif.COPIE_NB, libelle: 'Copie N&B', def: 75 },
    { type: TypeTarif.COPIE_COULEUR, libelle: 'Copie couleur', def: 10 },
    { type: TypeTarif.SCAN_NOIR, libelle: 'Scan noir', def: 0 },
    { type: TypeTarif.SCAN_COULEUR, libelle: 'Scan couleur', def: 0 },
    { type: TypeTarif.ENVOI, libelle: 'Envoi', def: 0 },
  ];
  for (const t of tarifDefs) {
    await prisma.tarifLeasing.create({
      data: {
        type: t.type,
        libelle: t.libelle,
        prixUnitaire: tarifs[t.type] ?? t.def,
      },
    });
  }

  const seqDefs: Array<{ entite: EntiteSequence; prefixe: string }> = [
    { entite: EntiteSequence.IMPRIMANTE, prefixe: 'IMP-' },
    { entite: EntiteSequence.ENTREE_STOCK, prefixe: 'ENT-' },
    { entite: EntiteSequence.AFFECTATION, prefixe: 'AFF-' },
    { entite: EntiteSequence.RELEVE, prefixe: 'REL-' },
    { entite: EntiteSequence.MAINTENANCE, prefixe: 'MNT-' },
    { entite: EntiteSequence.FACTURE, prefixe: 'FAC-' },
  ];
  for (const s of seqDefs) {
    await prisma.idSequenceConfig.create({
      data: { entite: s.entite, prefixe: s.prefixe, formatNum: '0000', dernierNumero: 0 },
    });
  }

  console.log(
    `  référentiels: ${marques.size} marques, ${fournisseurs.size} fournisseurs, ${agents.size} agents, ${services.size} services`,
  );
}

async function importPrinters(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Imprimantes');
  let n = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = str(r[0]);
    const numeroSerie = str(r[3]);
    if (!code || !numeroSerie) continue;

    const marqueNom = normalizeBrand(str(r[1]) ?? 'Canon');
    const modele = str(r[2]) ?? 'IR-ADV C930';
    const localisation = str(r[4]);
    const statut = mapStatutImprimante(str(r[5]));
    const fournisseurNom = str(r[6]) ?? 'ESAY Support';
    const dateInstallation = excelDate(r[7]);
    const prochaineMaintenance = excelDate(r[8]);
    const observations = str(r[12]);

    const marque = await upsertNamed('marque', marqueNom);
    const fournisseur = await upsertNamed('fournisseur', fournisseurNom);

    await prisma.imprimante.create({
      data: {
        code,
        modele,
        numeroSerie,
        localisation,
        statut,
        marqueId: marque.id,
        fournisseurId: fournisseur.id,
        dateInstallation,
        prochaineMaintenance,
        observations,
      },
    });
    n += 1;
  }
  console.log(`  imprimantes: ${n}`);
  return n;
}

async function ensureModele(modele: string, marqueNom: string, ref?: string | null) {
  const marque = await upsertNamed('marque', normalizeBrand(marqueNom));
  const existing = await prisma.modeleCartouche.findFirst({
    where: { modele, marqueId: marque.id },
  });
  if (existing) {
    if (ref && !existing.refFabricant) {
      return prisma.modeleCartouche.update({
        where: { id: existing.id },
        data: { refFabricant: ref },
      });
    }
    return existing;
  }
  return prisma.modeleCartouche.create({
    data: { modele, marqueId: marque.id, refFabricant: ref ?? null },
  });
}

async function ensureSku(modeleId: string, couleur: CouleurToner) {
  return prisma.cartoucheSku.upsert({
    where: { modeleId_couleur: { modeleId, couleur } },
    update: {},
    create: {
      modeleId,
      couleur,
      qteEntrees: 0,
      qteSorties: 0,
      qteRestante: 0,
      statut: StatutStock.AUCUN_STOCK,
    },
  });
}

async function importStock(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Stock Cartouches');

  // Stock disponible (lignes après header Modele/Couleur…)
  let stockHeader = -1;
  let entreesHeader = -1;
  for (let i = 0; i < rows.length; i++) {
    const a = str(rows[i]?.[0])?.toLowerCase() ?? '';
    if (a === 'modele' || a === 'modèle') stockHeader = i;
    if (a === 'id entree' || a === 'id entrée') entreesHeader = i;
  }

  let skus = 0;
  if (stockHeader >= 0) {
    for (let i = stockHeader + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const modele = str(r[0]);
      if (!modele || modele.toUpperCase() === 'TOTAL') break;
      const couleur = mapCouleur(str(r[1]));
      if (!couleur) continue;
      const marque = str(r[2]) ?? 'Canon';
      const ref = str(r[3]);
      const m = await ensureModele(modele, marque, ref);
      await ensureSku(m.id, couleur);
      skus += 1;
    }
  }

  let entrees = 0;
  if (entreesHeader >= 0) {
    for (let i = entreesHeader + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const code = str(r[0]);
      if (!code || !code.startsWith('ENT-')) continue;
      const dateEntree = excelDate(r[1]);
      if (!dateEntree) continue;
      const modeleNom = str(r[3]);
      const couleur = mapCouleur(str(r[4]));
      if (!modeleNom || !couleur) continue;
      const marque = str(r[5]) ?? 'Canon';
      const ref = str(r[6]);
      const qte = Math.max(0, Math.floor(num(r[7])));
      if (qte <= 0) continue;
      const fournisseurNom = str(r[8]);
      const observations = str(r[9]);
      const heureEntree = excelTime(r[2]);

      const m = await ensureModele(modeleNom, marque, ref);
      const sku = await ensureSku(m.id, couleur);
      const fournisseur = fournisseurNom
        ? await upsertNamed('fournisseur', fournisseurNom)
        : null;

      await prisma.entreeStock.create({
        data: {
          code,
          dateEntree,
          heureEntree,
          modeleId: m.id,
          skuId: sku.id,
          couleur,
          qte,
          fournisseurId: fournisseur?.id,
          observations,
        },
      });

      await prisma.cartoucheSku.update({
        where: { id: sku.id },
        data: {
          qteEntrees: { increment: qte },
          qteRestante: { increment: qte },
        },
      });
      entrees += 1;
    }
  }

  console.log(`  stock: ${skus} SKU, ${entrees} entrées`);
  return { skus, entrees };
}

async function importAffectations(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Affectations');
  let n = 0;
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = str(r[0]);
    if (!code || !code.startsWith('AFF-')) continue;
    const datePose = excelDate(r[1]);
    const heurePose = excelTime(r[2]);
    const impCode = str(r[3]);
    const modeleNom = str(r[7]) ?? 'C-EXV 64';
    if (!datePose || !impCode) continue;

    const qBlack = Math.max(0, Math.floor(num(r[8])));
    const qCyan = Math.max(0, Math.floor(num(r[9])));
    const qMagenta = Math.max(0, Math.floor(num(r[10])));
    const qYellow = Math.max(0, Math.floor(num(r[11])));
    const agentNom = str(r[14]);
    const motif = mapMotif(str(r[15]));
    const observations = str(r[17]);

    const imprimante = await prisma.imprimante.findUnique({ where: { code: impCode } });
    if (!imprimante) {
      console.warn(`  ! affectation ${code}: imprimante ${impCode} introuvable`);
      continue;
    }

    const m = await ensureModele(modeleNom, 'Canon');
    const agent = agentNom ? await upsertNamed('agent', agentNom) : null;

    const lignes: Array<{ couleur: CouleurToner; qte: number }> = [];
    if (qBlack > 0) lignes.push({ couleur: CouleurToner.TONER_BLACK, qte: qBlack });
    if (qCyan > 0) lignes.push({ couleur: CouleurToner.TONER_CYAN, qte: qCyan });
    if (qMagenta > 0) lignes.push({ couleur: CouleurToner.TONER_MAGENTA, qte: qMagenta });
    if (qYellow > 0) lignes.push({ couleur: CouleurToner.TONER_YELLOW, qte: qYellow });
    if (lignes.length === 0) continue;

    const aff = await prisma.affectation.create({
      data: {
        code,
        datePose,
        heurePose,
        imprimanteId: imprimante.id,
        modeleId: m.id,
        agentId: agent?.id,
        motif,
        statutPose: StatutPose.OK,
        observations,
        lignes: {
          create: await Promise.all(
            lignes.map(async (l) => {
              const sku = await ensureSku(m.id, l.couleur);
              return { skuId: sku.id, couleur: l.couleur, qte: l.qte };
            }),
          ),
        },
      },
    });

    for (const l of lignes) {
      const sku = await ensureSku(m.id, l.couleur);
      const updated = await prisma.cartoucheSku.update({
        where: { id: sku.id },
        data: {
          qteSorties: { increment: l.qte },
          qteRestante: { decrement: l.qte },
        },
      });
      await prisma.cartoucheSku.update({
        where: { id: sku.id },
        data: {
          statut: computeStatutStock(updated.qteEntrees, updated.qteSorties) as StatutStock,
        },
      });
    }

    void aff;
    n += 1;
  }
  console.log(`  affectations: ${n}`);
  return n;
}

async function syncSkuStatuts() {
  const skus = await prisma.cartoucheSku.findMany();
  for (const s of skus) {
    await prisma.cartoucheSku.update({
      where: { id: s.id },
      data: {
        qteRestante: s.qteEntrees - s.qteSorties,
        statut: computeStatutStock(s.qteEntrees, s.qteSorties) as StatutStock,
      },
    });
  }
}

async function importReleves(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Releves Copies');
  type Raw = {
    code: string;
    mois: string;
    date: Date;
    heure: Date | null;
    impCode: string;
    c112: number;
    c113: number;
    c122: number;
    c123: number;
    c501: number | null;
    scanNoir: number;
    scanCouleur: number;
    envoi: number;
    statutRaw: string | null;
    observations: string | null;
  };

  const raws: Raw[] = [];
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const code = str(r[0]);
    if (!code || !code.startsWith('REL-')) continue;
    const mois = str(r[1]);
    const date = excelDate(r[2]);
    const impCode = str(r[4]);
    if (!mois || !date || !impCode) continue;
    raws.push({
      code,
      mois,
      date,
      heure: excelTime(r[3]),
      impCode,
      c112: Math.floor(num(r[7])),
      c113: Math.floor(num(r[8])),
      c122: Math.floor(num(r[9])),
      c123: Math.floor(num(r[10])),
      c501: r[18] == null || r[18] === '' ? null : Math.floor(num(r[18])),
      scanNoir: Math.floor(num(r[22])),
      scanCouleur: Math.floor(num(r[23])),
      envoi: Math.floor(num(r[24])),
      statutRaw: str(r[21]),
      observations: str(r[32]),
    });
  }

  // Ordre chronologique par imprimante
  raws.sort((a, b) => {
    if (a.impCode !== b.impCode) return a.impCode.localeCompare(b.impCode);
    if (a.mois !== b.mois) return a.mois.localeCompare(b.mois);
    return a.date.getTime() - b.date.getTime();
  });

  const prevByImp = new Map<
    string,
    {
      totalNoir: number;
      totalCouleur: number;
      c112: number;
      c113: number;
      c122: number;
      c123: number;
      c501?: number | null;
      scanNoir: number;
      scanCouleur: number;
      envoi: number;
      quotaNoirReport: number;
      quotaCouleurReport: number;
    }
  >();

  let n = 0;
  for (const row of raws) {
    const imprimante = await prisma.imprimante.findUnique({ where: { code: row.impCode } });
    if (!imprimante) {
      console.warn(`  ! relevé ${row.code}: imprimante ${row.impCode} introuvable`);
      continue;
    }

    const prev = prevByImp.get(row.impCode) ?? null;
    const isFirst = !prev;
    const counters = {
      c112: row.c112,
      c113: row.c113,
      c122: row.c122,
      c123: row.c123,
      c501: row.c501,
      scanNoir: row.scanNoir,
      scanCouleur: row.scanCouleur,
      envoi: row.envoi,
    };

    const computed = computeReleve(counters, prev);

    const statutExcel = mapStatutReleve(row.statutRaw, isFirst);
    const statut =
      statutExcel === StatutReleve.BASE_INITIALE || isFirst
        ? StatutReleve.BASE_INITIALE
        : computed.statut === StatutReleve.OK
          ? statutExcel
          : computed.statut;

    await prisma.releveCompteur.create({
      data: {
        code: row.code,
        imprimanteId: imprimante.id,
        moisFacture: row.mois,
        dateReleve: row.date,
        heureReleve: row.heure,
        c112: row.c112,
        c113: row.c113,
        c122: row.c122,
        c123: row.c123,
        c501: row.c501,
        scanNoir: row.scanNoir,
        scanCouleur: row.scanCouleur,
        envoi: row.envoi,
        totalNoir: computed.totalNoir,
        totalCouleur: computed.totalCouleur,
        ancienTotalNoir: prev?.totalNoir ?? null,
        ancienTotalCouleur: prev?.totalCouleur ?? null,
        copiesNoirBrutes: computed.copiesNoirBrutes,
        copiesCouleurBrutes: computed.copiesCouleurBrutes,
        scansNoirBruts: computed.scansNoirBruts,
        scansCouleurBruts: computed.scansCouleurBruts,
        envoisBruts: computed.envoisBruts,
        copiesNoirDelta: computed.copiesNoirDelta,
        copiesCouleurDelta: computed.copiesCouleurDelta,
        quotaNoirDispo: computed.quotaNoirDispo,
        quotaCouleurDispo: computed.quotaCouleurDispo,
        copiesNoirIncluses: computed.copiesNoirIncluses,
        copiesCouleurIncluses: computed.copiesCouleurIncluses,
        quotaNoirReport: computed.quotaNoirReport,
        quotaCouleurReport: computed.quotaCouleurReport,
        copiesNoirFacturer: computed.copiesNoirFacturer,
        copiesCouleurFacturer: computed.copiesCouleurFacturer,
        totalCopiesFacturer: computed.totalCopiesFacturer,
        ancienScanNoir: prev?.scanNoir ?? null,
        ancienScanCouleur: prev?.scanCouleur ?? null,
        ancienEnvoi: prev?.envoi ?? null,
        scansNoirFacturer: computed.scansNoirFacturer,
        scansCouleurFacturer: computed.scansCouleurFacturer,
        envoisFacturer: computed.envoisFacturer,
        alerteDeltaHaut: computed.alerteDeltaHaut,
        statut,
        observations: row.observations,
      },
    });

    prevByImp.set(row.impCode, {
      totalNoir: computed.totalNoir,
      totalCouleur: computed.totalCouleur,
      c112: row.c112,
      c113: row.c113,
      c122: row.c122,
      c123: row.c123,
      c501: row.c501,
      scanNoir: row.scanNoir,
      scanCouleur: row.scanCouleur,
      envoi: row.envoi,
      quotaNoirReport: computed.quotaNoirReport,
      quotaCouleurReport: computed.quotaCouleurReport,
    });
    n += 1;
  }
  console.log(`  relevés: ${n}`);
  return n;
}

async function importFacturation(wb: XLSX.WorkBook) {
  const rows = sheetMatrix(wb, 'Facturation');
  if (rows.length < 8) {
    console.log('  facturation: feuille vide');
    return 0;
  }

  const meta = rows[3] ?? [];
  const mois = str(meta[1]) ?? '2026-07';
  const debut = excelDate(meta[3]) ?? new Date(`${mois}-01T00:00:00Z`);
  const fin = excelDate(meta[5]) ?? new Date(`${mois}-28T00:00:00Z`);
  const prixNb = num(meta[7]);
  const prixCouleur = num(meta[9]);
  const prixScanNoir = num(meta[11]);
  const prixScanCouleur = num(meta[13]);
  const prixEnvoi = num(meta[15]);

  // Find header row with "ID Imprimante"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (str(rows[i]?.[0])?.toLowerCase().includes('id imprimante')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    console.log('  facturation: en-tête introuvable');
    return 0;
  }

  const periode = await prisma.facturePeriode.create({
    data: {
      code: `FAC-${mois}`,
      mois,
      debutPeriode: debut,
      finPeriode: fin,
      prixNb,
      prixCouleur,
      prixScanNoir,
      prixScanCouleur,
      prixEnvoi,
      montantTotal: 0,
      statut: StatutFacturePeriode.CALCULEE,
    },
  });

  let total = 0;
  let lignes = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const impCode = str(r[0]);
    if (!impCode || !impCode.startsWith('IMP-')) continue;
    const imprimante = await prisma.imprimante.findUnique({ where: { code: impCode } });
    if (!imprimante) continue;

    const montantTotal = num(r[18]);
    total += montantTotal;
    await prisma.factureLigne.create({
      data: {
        periodeId: periode.id,
        imprimanteId: imprimante.id,
        nbReleves: Math.floor(num(r[3])),
        copiesNb: Math.floor(num(r[4])),
        copiesCouleur: Math.floor(num(r[5])),
        totalCopies: Math.floor(num(r[6])),
        scansNoir: Math.floor(num(r[7])),
        scansCouleur: Math.floor(num(r[8])),
        envois: Math.floor(num(r[9])),
        montantCopies: num(r[16]),
        montantScans: num(r[17]),
        montantTotal,
        statut: mapFactureLigneStatut(str(r[19])),
      },
    });
    lignes += 1;
  }

  await prisma.facturePeriode.update({
    where: { id: periode.id },
    data: { montantTotal: total },
  });

  console.log(`  facturation ${mois}: ${lignes} lignes, total=${total}`);
  return lignes;
}

async function syncSequences() {
  const specs: Array<{
    entite: EntiteSequence;
    table: () => Promise<{ code: string }[]>;
  }> = [
    {
      entite: EntiteSequence.IMPRIMANTE,
      table: () => prisma.imprimante.findMany({ select: { code: true } }),
    },
    {
      entite: EntiteSequence.ENTREE_STOCK,
      table: () => prisma.entreeStock.findMany({ select: { code: true } }),
    },
    {
      entite: EntiteSequence.AFFECTATION,
      table: () => prisma.affectation.findMany({ select: { code: true } }),
    },
    {
      entite: EntiteSequence.RELEVE,
      table: () => prisma.releveCompteur.findMany({ select: { code: true } }),
    },
    {
      entite: EntiteSequence.MAINTENANCE,
      table: () => prisma.maintenance.findMany({ select: { code: true } }),
    },
    {
      entite: EntiteSequence.FACTURE,
      table: () => prisma.facturePeriode.findMany({ select: { code: true } }),
    },
  ];

  for (const s of specs) {
    const rows = await s.table();
    const maxNum = rows.reduce((acc, r) => {
      const n = Number(String(r.code).replace(/\D/g, '')) || 0;
      return Math.max(acc, n);
    }, 0);
    await prisma.idSequenceConfig.update({
      where: { entite: s.entite },
      data: { dernierNumero: maxNum },
    });
  }
  console.log('  séquences synchronisées');
}

async function main() {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_XLSX;
  if (!fs.existsSync(file)) {
    console.error(`Fichier introuvable: ${file}`);
    process.exit(1);
  }

  console.log(`Lecture: ${file}`);
  const wb = XLSX.readFile(file, { cellDates: true });
  console.log(`Feuilles: ${wb.SheetNames.join(', ')}`);

  await wipeExceptUsers();

  console.log('→ Import…');
  await importReferentiels(wb);
  await importPrinters(wb);
  await importStock(wb);
  await importAffectations(wb);
  await syncSkuStatuts();
  await importReleves(wb);
  await importFacturation(wb);
  await syncSequences();

  const users = await prisma.utilisateur.count();
  const summary = {
    users,
    imprimantes: await prisma.imprimante.count(),
    modeles: await prisma.modeleCartouche.count(),
    skus: await prisma.cartoucheSku.count(),
    entrees: await prisma.entreeStock.count(),
    affectations: await prisma.affectation.count(),
    releves: await prisma.releveCompteur.count(),
    factures: await prisma.facturePeriode.count(),
  };
  console.log('\n✓ Import terminé', summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
