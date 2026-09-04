import * as fs from 'fs';
import { absoluteUploadPath } from '../upload/report-files';
import type { LeasingMensuelleReportData, ReportAttachment } from './monthly-leasing-report.builder';

const MOIS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export type LeasingMensuelleHtmlView = {
  meta: {
    moisLabel: string;
    periodeDebut: string;
    periodeFin: string;
    periodeDebutIso: string;
    periodeFinIso: string;
    reference: string;
    edition: string;
    client: string;
    footerBrand: string;
    prixNb: number;
    prixCouleur: number;
  };
  releves: Array<{
    imprimante: string;
    localisation: string;
    code: string;
    debutN: number;
    debutC: number;
    finN: number;
    finC: number;
    diffN: number;
    diffC: number;
  }>;
  /** Détail facturation : copies hors quota × tarifs (0 F si sous quota). */
  facturation: FacturationRow[];
  totauxFacturation: {
    factN: number;
    factC: number;
    montantN: number;
    montantC: number;
    montantTotal: number;
  };
  depassement: MargeRow[];
  sousMarge: MargeRow[];
  cumulMargeN: number;
  cumulMargeC: number;
  assistances: Array<{
    imprimante: string;
    localisation: string;
    dates: string[];
    nb: number;
  }>;
  annexeCompteurs: AnnexeRow[];
  annexeInterventions: AnnexeRow[];
  pdfAnnexes: Array<{ path: string; label: string }>;
};

type MargeRow = {
  imprimante: string;
  localisation: string;
  quotaN: number;
  quotaC: number;
  consoN: number;
  consoC: number;
  factN: number;
  factC: number;
  margeRestanteN: number;
  margeRestanteC: number;
};

type FacturationRow = {
  imprimante: string;
  localisation: string;
  code: string;
  consoN: number;
  consoC: number;
  quotaN: number;
  quotaC: number;
  /** Copies noir hors quota (0 si sous quota). */
  factN: number;
  /** Copies couleur hors quota (0 si sous quota). */
  factC: number;
  montantN: number;
  montantC: number;
  /** Montant ligne = 0 F si aucun dépassement. */
  montantTotal: number;
  sousQuota: boolean;
};

type AnnexeRow = {
  label: string;
  subtitle: string;
  imageDataUri: string | null;
};

export type LeasingMensuelleHtmlInput = LeasingMensuelleReportData & {
  clientNom?: string;
};

export function mapToHtmlView(data: LeasingMensuelleHtmlInput): LeasingMensuelleHtmlView {
  const [y, m] = data.mois.split('-').map(Number);
  const debut = new Date(Date.UTC(y, m - 1, 1));
  const fin = new Date(Date.UTC(y, m, 0));
  const reference = `RPT-${data.mois}`;

  const releves = data.releves.map((r) => {
    const finN = r.totalNoir ?? r.c112 + r.c113;
    const finC = r.totalCouleur ?? r.c122 + r.c123;
    const debutN = r.ancienTotalNoir ?? Math.max(0, finN - r.deltaN);
    const debutC = r.ancienTotalCouleur ?? Math.max(0, finC - r.deltaC);
    return {
      imprimante: r.imprimante,
      localisation: r.localisation,
      code: r.code,
      debutN,
      debutC,
      finN,
      finC,
      diffN: r.deltaN,
      diffC: r.deltaC,
    };
  });

  const prixNb = data.prixNb ?? data.facture?.prixNb ?? 0;
  const prixCouleur = data.prixCouleur ?? data.facture?.prixCouleur ?? 0;

  const facturation: FacturationRow[] = data.releves.map((r) => {
    const factN = Math.max(0, r.factN ?? 0);
    const factC = Math.max(0, r.factC ?? 0);
    const montantN = factN * prixNb;
    const montantC = factC * prixCouleur;
    const montantTotal = montantN + montantC;
    return {
      imprimante: r.imprimante,
      localisation: r.localisation,
      code: r.code,
      consoN: r.deltaN,
      consoC: r.deltaC,
      quotaN: r.quotaNoirDispo ?? 1000,
      quotaC: r.quotaCouleurDispo ?? 2000,
      factN,
      factC,
      montantN,
      montantC,
      montantTotal,
      sousQuota: factN === 0 && factC === 0,
    };
  });

  const totauxFacturation = facturation.reduce(
    (acc, r) => {
      acc.factN += r.factN;
      acc.factC += r.factC;
      acc.montantN += r.montantN;
      acc.montantC += r.montantC;
      acc.montantTotal += r.montantTotal;
      return acc;
    },
    { factN: 0, factC: 0, montantN: 0, montantC: 0, montantTotal: 0 },
  );

  const margeRows: MargeRow[] = data.releves.map((r) => {
    const quotaN = r.quotaNoirDispo ?? 1000;
    const quotaC = r.quotaCouleurDispo ?? 2000;
    const consoN = r.deltaN;
    const consoC = r.deltaC;
    const factN = Math.max(0, r.factN ?? 0);
    const factC = Math.max(0, r.factC ?? 0);
    // Affichage : conso − quota (négatif = dépassement). Le report DB est toujours ≥ 0.
    const margeRestanteN = quotaN - consoN;
    const margeRestanteC = quotaC - consoC;
    return {
      imprimante: r.imprimante,
      localisation: r.localisation,
      quotaN,
      quotaC,
      consoN,
      consoC,
      factN,
      factC,
      margeRestanteN,
      margeRestanteC,
    };
  });

  // Aligné sur la facturation : dépassement = copies hors quota à facturer
  const depassement = margeRows.filter((r) => r.factN > 0 || r.factC > 0);
  const sousMarge = margeRows.filter((r) => r.factN === 0 && r.factC === 0);
  const cumulMargeN = sousMarge.reduce(
    (s, r) => s + Math.max(0, r.margeRestanteN),
    0,
  );
  const cumulMargeC = sousMarge.reduce(
    (s, r) => s + Math.max(0, r.margeRestanteC),
    0,
  );

  const assistanceMap = new Map<
    string,
    { imprimante: string; localisation: string; dates: string[] }
  >();
  for (const mnt of data.maintenances) {
    if (mnt.type !== 'ASSISTANCE') continue;
    const dateFr = fmtDateFr(mnt.date);
    const targets =
      mnt.copieurs && mnt.copieurs.length > 0
        ? mnt.copieurs
        : [{ code: mnt.imprimante, localisation: mnt.localisation }];
    for (const cop of targets) {
      const key = cop.code;
      const existing = assistanceMap.get(key);
      if (existing) {
        if (!existing.dates.includes(dateFr)) existing.dates.push(dateFr);
      } else {
        assistanceMap.set(key, {
          imprimante: cop.code,
          localisation: cop.localisation,
          dates: [dateFr],
        });
      }
    }
  }
  const assistances = [...assistanceMap.values()]
    .map((a) => ({ ...a, nb: a.dates.length }))
    .sort((a, b) => a.imprimante.localeCompare(b.imprimante));

  const pdfAnnexes: Array<{ path: string; label: string }> = [];

  const annexeCompteurs: AnnexeRow[] = [];
  for (const r of data.releves) {
    const attachment = r.attachment;
    if (!attachmentExists(attachment)) continue;
    if (attachment!.mime === 'application/pdf') {
      collectPdfAnnex(attachment, pdfAnnexes, `Relevé ${r.code}`);
      continue;
    }
    const imageDataUri = attachmentToDataUri(attachment);
    if (!imageDataUri) continue;
    annexeCompteurs.push({
      label: `${r.imprimante} — ${r.code}`,
      subtitle: `Relevé compteur · ${data.mois}`,
      imageDataUri,
    });
  }

  const annexeInterventions: AnnexeRow[] = [];
  for (const m of data.maintenances) {
    const attachment = m.attachment;
    if (!attachmentExists(attachment)) continue;
    if (attachment!.mime === 'application/pdf') {
      collectPdfAnnex(attachment, pdfAnnexes, `Maintenance ${m.code}`);
      continue;
    }
    const imageDataUri = attachmentToDataUri(attachment);
    if (!imageDataUri) continue;
    annexeInterventions.push({
      label: `${m.code} — ${m.imprimante}`,
      subtitle: `${m.type} · ${m.actions || 'Intervention'}`,
      imageDataUri,
    });
  }

  return {
    meta: {
      moisLabel: `${MOIS_FR[m - 1]} ${y}`,
      periodeDebut: fmtDateFr(debut.toISOString().slice(0, 10)),
      periodeFin: fmtDateFr(fin.toISOString().slice(0, 10)),
      periodeDebutIso: debut.toISOString().slice(0, 10),
      periodeFinIso: fin.toISOString().slice(0, 10),
      reference,
      edition: fmtEdition(new Date()),
      client: data.clientNom?.trim() || 'Client',
      footerBrand: 'Ivoprest',
      prixNb,
      prixCouleur,
    },
    releves,
    facturation,
    totauxFacturation,
    depassement,
    sousMarge,
    cumulMargeN,
    cumulMargeC,
    assistances,
    annexeCompteurs,
    annexeInterventions,
    pdfAnnexes,
  };
}

/** Données fictives — même structure que la maquette HTML validée. */
export function sampleHtmlView(): LeasingMensuelleHtmlView {
  return mapToHtmlView({
    mois: '2026-09',
    clientNom: "Direction des Systèmes d'Information",
    campagne: null,
    facture: null,
    prixNb: 15,
    prixCouleur: 45,
    releves: [
      {
        code: 'REL-0012',
        imprimante: 'IMP-0001',
        localisation: 'Bâtiment A — Étage 3',
        statut: 'VALIDE',
        c112: 10000,
        c113: 28,
        c122: 0,
        c123: 6,
        c501: null,
        deltaN: 983,
        deltaC: 3,
        factN: 0,
        factC: 0,
        motif: '',
        totalNoir: 11011,
        totalCouleur: 9,
        ancienTotalNoir: 10028,
        ancienTotalCouleur: 6,
        quotaNoirDispo: 1000,
        quotaCouleurDispo: 2000,
        quotaNoirReport: 17,
        quotaCouleurReport: 1997,
        attachment: null,
      },
      {
        code: 'REL-0013',
        imprimante: 'IMP-0002',
        localisation: 'Bâtiment B — Accueil',
        statut: 'VALIDE',
        c112: 20000,
        c113: 19,
        c122: 0,
        c123: 12,
        c501: null,
        deltaN: 996,
        deltaC: 6,
        factN: 0,
        factC: 0,
        motif: '',
        totalNoir: 21015,
        totalCouleur: 18,
        ancienTotalNoir: 20019,
        ancienTotalCouleur: 12,
        quotaNoirDispo: 1000,
        quotaCouleurDispo: 2000,
        quotaNoirReport: 4,
        quotaCouleurReport: 1994,
        attachment: null,
      },
      {
        code: 'REL-0014',
        imprimante: 'IMP-0003',
        localisation: 'Bâtiment Équateur — Étage 10',
        statut: 'VALIDE',
        c112: 1000,
        c113: 350,
        c122: 1000,
        c123: 1023,
        c501: null,
        deltaN: 1347,
        deltaC: 2017,
        factN: 347,
        factC: 17,
        motif: '',
        totalNoir: 1350,
        totalCouleur: 2023,
        ancienTotalNoir: 3,
        ancienTotalCouleur: 6,
        quotaNoirDispo: 1000,
        quotaCouleurDispo: 2000,
        quotaNoirReport: -347,
        quotaCouleurReport: -17,
        attachment: null,
      },
    ],
    maintenances: [
      {
        code: 'MNT-0045',
        type: 'Assistance',
        date: '2026-09-05',
        imprimante: 'IMP-0001',
        localisation: 'Bâtiment A — Étage 3',
        actions: 'Changement toner N',
        releveCode: 'REL-0012',
        attachment: null,
      },
      {
        code: 'MNT-0046',
        type: 'Assistance',
        date: '2026-09-08',
        imprimante: 'IMP-0002',
        localisation: 'Bâtiment B — Accueil',
        actions: 'Nettoyage bac récupération',
        releveCode: null,
        attachment: null,
      },
      {
        code: 'MNT-0047',
        type: 'Assistance',
        date: '2026-09-01',
        imprimante: 'IMP-0003',
        localisation: 'Bâtiment Équateur — Étage 10',
        actions: 'Prélèvement mensuel',
        releveCode: 'REL-0014',
        attachment: null,
      },
    ],
  });
}

function collectPdfAnnex(
  attachment: ReportAttachment | null | undefined,
  list: Array<{ path: string; label: string }>,
  label: string,
) {
  if (!attachment?.relativePath || attachment.mime !== 'application/pdf') return;
  const abs = absoluteUploadPath(attachment.relativePath);
  if (!fs.existsSync(abs)) return;
  list.push({ path: abs, label });
}

function attachmentExists(attachment: ReportAttachment | null | undefined): boolean {
  if (!attachment?.relativePath) return false;
  return fs.existsSync(absoluteUploadPath(attachment.relativePath));
}

function attachmentToDataUri(attachment: ReportAttachment | null | undefined): string | null {
  if (!attachment?.relativePath || !attachment.mime) return null;
  if (!IMAGE_MIMES.has(attachment.mime)) return null;
  const abs = absoluteUploadPath(attachment.relativePath);
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  return `data:${attachment.mime};base64,${buf.toString('base64')}`;
}

function fmtDateFr(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleDateString('fr-FR');
}

function fmtEdition(d: Date) {
  const day = d.getDate();
  const suffix = day === 1 ? '1<sup>er</sup>' : String(day);
  const month = MOIS_FR[d.getMonth()];
  return `${suffix} ${month.toLowerCase()} ${d.getFullYear()}`;
}

export function fmtNum(n: number) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('fr-FR');
  return n < 0 ? `−${formatted}` : formatted;
}

/** Montants en francs CFA (XOF), sans décimales. */
export function fmtMoney(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} F`;
}
