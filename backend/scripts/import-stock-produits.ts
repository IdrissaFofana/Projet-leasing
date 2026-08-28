/**
 * Import Excel stock produits (hors leasing) → PostgreSQL
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/import-stock-produits.ts
 *   npx ts-node --transpile-only scripts/import-stock-produits.ts "C:\\chemin\\fichier.xlsx"
 */
import { PrismaClient, StatutStockProduit } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { computeStatutStockProduit } from '../src/stock-produits/stock-produits.service';

const prisma = new PrismaClient();

const DEFAULT_XLSX = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'Suivi_receptions_livraisons_produits.xlsx',
);

function str(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.floor(n) : 0;
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
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapStatut(raw: string | null, qteRecue: number, qteLivree: number, dateReception: Date | null): StatutStockProduit {
  const s = (raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (s.includes('annul')) return StatutStockProduit.ANNULE;
  if (s.includes('attente')) return StatutStockProduit.RECEPTION_EN_ATTENTE;
  if (s.includes('partiel')) return StatutStockProduit.PARTIELLEMENT_LIVRE;
  if (s === 'livre' || s.startsWith('livre')) return StatutStockProduit.LIVRE;
  if (s.includes('stock')) return StatutStockProduit.EN_STOCK;
  return computeStatutStockProduit(qteRecue, qteLivree, dateReception);
}

async function main() {
  const file = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_XLSX;
  if (!fs.existsSync(file)) {
    console.error(`Fichier introuvable: ${file}`);
    process.exit(1);
  }

  console.log(`Lecture: ${file}`);
  const wb = XLSX.readFile(file, { cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('suivi')) ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  console.log(`Feuille: ${sheetName}`);

  // Remplace les données existantes du module (import métier initial)
  await prisma.stockProduit.deleteMany();

  let created = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const designation = str(r[1]);
    if (!designation) continue;

    const numeroExcel = num(r[0]) || created + 1;
    const reference = str(r[2]);
    const fournisseur = str(r[3]);
    const qteRecue = Math.max(0, num(r[4]));
    const dateReception = excelDate(r[5]);
    const bonReception = str(r[6]);
    const qteLivree = Math.max(0, num(r[7]));
    const dateLivraison = excelDate(r[8]);
    const destinataire = str(r[9]);
    const statutRaw = str(r[10]);
    const observations = str(r[11]);

    const qteLivreeSafe = Math.min(qteLivree, qteRecue);
    const statut = mapStatut(statutRaw, qteRecue, qteLivreeSafe, dateReception);

    await prisma.stockProduit.create({
      data: {
        numero: numeroExcel,
        designation,
        reference,
        fournisseur,
        qteRecue,
        dateReception,
        bonReception,
        qteLivree: qteLivreeSafe,
        dateLivraison,
        destinataire,
        statut,
        statutManuel: false,
        observations,
      },
    });
    created += 1;
  }

  console.log(`✓ Import terminé: ${created} lignes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
