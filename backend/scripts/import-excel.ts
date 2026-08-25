/**
 * Import Excel → PostgreSQL (Prisma)
 *
 * Usage:
 *   npx ts-node scripts/import-excel.ts
 *   npx ts-node scripts/import-excel.ts "C:\\chemin\\fichier.xlsx"
 *
 * Feuilles attendues (noms souples) :
 *   - Imprimantes / Parc
 *   - Stock / Entrées (optionnel)
 */
import { PrismaClient, StatutImprimante } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const DEFAULT_XLSX = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'Gestion cartouche et imprimante.xlsx',
);

type Row = Record<string, unknown>;

function sheetRows(wb: XLSX.WorkBook, candidates: string[]): Row[] {
  const names = wb.SheetNames;
  const found =
    candidates.find((c) => names.some((n) => n.toLowerCase() === c.toLowerCase())) ??
    names.find((n) =>
      candidates.some((c) => n.toLowerCase().includes(c.toLowerCase().slice(0, 6))),
    );
  if (!found) return [];
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[found], { defval: null });
}

function cell(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== '') {
      return String(row[hit]).trim();
    }
  }
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.toLowerCase().includes(k.toLowerCase()));
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== '') {
      return String(row[hit]).trim();
    }
  }
  return null;
}

function excelDate(value: string | null): Date | null {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    const parsed = XLSX.SSF.parse_date_code(n);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeBrand(nom: string) {
  if (nom.toUpperCase() === 'CANON') return 'Canon';
  return nom;
}

async function importPrinters(rows: Row[]) {
  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const numeroSerie = cell(row, ['N° Série', 'N° serie', 'Numero Serie', 'numéro série', 'Serie']);
    if (!numeroSerie) {
      skipped += 1;
      continue;
    }

    const code =
      cell(row, ['ID', 'Code', 'ID Imprimante', 'Code Imprimante']) ?? undefined;
    const modele = cell(row, ['Modèle', 'Modele', 'Model']) ?? 'IR-ADV C930';
    const marqueNom = normalizeBrand(cell(row, ['Marque', 'Brand']) ?? 'Canon');
    const fournisseurNom = cell(row, ['Fournisseur', 'Supplier']) ?? 'ESAY Support';
    const localisation = cell(row, ['Localisation', 'Emplacement', 'Site']);
    const dateInstallation = excelDate(
      cell(row, ['Date installation', 'Date Installation', 'Installation']),
    );

    const marque = await prisma.marque.upsert({
      where: { nom: marqueNom },
      update: {},
      create: { nom: marqueNom },
    });
    const fournisseur = await prisma.fournisseur.upsert({
      where: { nom: fournisseurNom },
      update: {},
      create: { nom: fournisseurNom },
    });

    await prisma.imprimante.upsert({
      where: { numeroSerie },
      update: {
        modele,
        marqueId: marque.id,
        fournisseurId: fournisseur.id,
        localisation: localisation ?? undefined,
        dateInstallation: dateInstallation ?? undefined,
        ...(code ? { code } : {}),
      },
      create: {
        code: code ?? `IMP-TMP-${numeroSerie.slice(-4)}`,
        modele,
        numeroSerie,
        marqueId: marque.id,
        fournisseurId: fournisseur.id,
        localisation: localisation ?? undefined,
        dateInstallation: dateInstallation ?? undefined,
        statut: StatutImprimante.FONCTIONNELLE,
      },
    });
    upserted += 1;
  }

  const maxCode = await prisma.imprimante.findMany({ select: { code: true } });
  const maxNum = maxCode.reduce((acc, p) => {
    const n = Number(String(p.code).replace(/\D/g, '')) || 0;
    return Math.max(acc, n);
  }, 0);
  if (maxNum > 0) {
    await prisma.idSequenceConfig.updateMany({
      where: { entite: 'IMPRIMANTE' },
      data: { dernierNumero: maxNum },
    });
  }

  return { upserted, skipped };
}

async function main() {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_XLSX;
  if (!fs.existsSync(file)) {
    console.error(`Fichier introuvable: ${file}`);
    process.exit(1);
  }

  console.log(`Lecture: ${file}`);
  const wb = XLSX.readFile(file);
  console.log(`Feuilles: ${wb.SheetNames.join(', ')}`);

  const printerRows = sheetRows(wb, ['Imprimantes', 'Parc', 'Printers']);
  console.log(`Lignes imprimantes: ${printerRows.length}`);
  const printers = await importPrinters(printerRows);
  console.log(`Imprimantes upsert: ${printers.upserted} (ignorées: ${printers.skipped})`);

  console.log('Import terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
