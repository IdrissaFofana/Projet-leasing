/**
 * Modèle PDF « Leasing mensuelle » — document client de référence.
 * Données fictives pour valider la structure avant branchement sur l’API.
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { esayHex } from './esay-theme';

export type LeasingMensuelleTemplateMeta = {
  client?: string;
  mois?: string;
  periodeDebut?: string;
  periodeFin?: string;
  reference?: string;
};

type TocEntry = { title: string; page: number; level?: 1 | 2 };

type ReleveLigne = {
  code: string;
  imprimante: string;
  localisation: string;
  debutN: number;
  debutC: number;
  finN: number;
  finC: number;
  diffN: number;
  diffC: number;
};

type MargeLigne = {
  imprimante: string;
  localisation: string;
  quotaN: number;
  quotaC: number;
  consoN: number;
  consoC: number;
  margeRestanteN: number;
  margeRestanteC: number;
};

type AssistanceLigne = {
  imprimante: string;
  localisation: string;
  dates: string[];
};

type AnnexeItem = {
  label: string;
  subtitle: string;
};

const SAMPLE = {
  client: 'Direction des Systèmes d’Information — ESAY Corporation',
  mois: 'Septembre 2026',
  periodeDebut: '01/09/2026',
  periodeFin: '30/09/2026',
  reference: 'RPT-2026-09-MODELE',
  releves: [
    {
      code: 'REL-0012',
      imprimante: 'IMP-0001',
      localisation: 'Bâtiment A — Étage 3',
      debutN: 10028,
      debutC: 6,
      finN: 11011,
      finC: 9,
      diffN: 983,
      diffC: 3,
    },
    {
      code: 'REL-0013',
      imprimante: 'IMP-0002',
      localisation: 'Bâtiment B — Accueil',
      debutN: 20019,
      debutC: 12,
      finN: 21015,
      finC: 18,
      diffN: 996,
      diffC: 6,
    },
    {
      code: 'REL-0014',
      imprimante: 'IMP-0003',
      localisation: 'Bâtiment Équateur — Étage 10',
      debutN: 3,
      debutC: 6,
      finN: 1350,
      finC: 2023,
      diffN: 1347,
      diffC: 2017,
    },
  ] satisfies ReleveLigne[],
  depassement: [
    {
      imprimante: 'IMP-0003',
      localisation: 'Bâtiment Équateur — Étage 10',
      quotaN: 1000,
      quotaC: 2000,
      consoN: 1347,
      consoC: 2017,
      margeRestanteN: -347,
      margeRestanteC: -17,
    },
  ] satisfies MargeLigne[],
  sousMarge: [
    {
      imprimante: 'IMP-0001',
      localisation: 'Bâtiment A — Étage 3',
      quotaN: 1000,
      quotaC: 2000,
      consoN: 983,
      consoC: 3,
      margeRestanteN: 17,
      margeRestanteC: 1997,
    },
    {
      imprimante: 'IMP-0002',
      localisation: 'Bâtiment B — Accueil',
      quotaN: 1000,
      quotaC: 2000,
      consoN: 996,
      consoC: 6,
      margeRestanteN: 4,
      margeRestanteC: 1994,
    },
  ] satisfies MargeLigne[],
  assistances: [
    {
      imprimante: 'IMP-0001',
      localisation: 'Bâtiment A — Étage 3',
      dates: ['05/09/2026', '12/09/2026', '26/09/2026'],
    },
    {
      imprimante: 'IMP-0002',
      localisation: 'Bâtiment B — Accueil',
      dates: ['08/09/2026', '22/09/2026'],
    },
    {
      imprimante: 'IMP-0003',
      localisation: 'Bâtiment Équateur — Étage 10',
      dates: ['01/09/2026', '15/09/2026', '29/09/2026'],
    },
  ] satisfies AssistanceLigne[],
  annexeCompteurs: [
    { label: 'IMP-0001 — REL-0012', subtitle: 'Relevé compteur · Prélèvement 05/09/2026' },
    { label: 'IMP-0002 — REL-0013', subtitle: 'Relevé compteur · Prélèvement 08/09/2026' },
    { label: 'IMP-0003 — REL-0014', subtitle: 'Relevé compteur · Prélèvement 01/09/2026' },
  ] satisfies AnnexeItem[],
  annexeInterventions: [
    { label: 'MNT-0045 — IMP-0001', subtitle: 'Assistance · Changement toner N' },
    { label: 'MNT-0046 — IMP-0002', subtitle: 'Assistance · Nettoyage bac récupération' },
    { label: 'MNT-0047 — IMP-0003', subtitle: 'Assistance · Prélèvement mensuel' },
  ] satisfies AnnexeItem[],
};

function logoPath() {
  return path.join(process.cwd(), 'assets', 'logo-esay.png');
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

/** Page de garde — portrait, mise en page client. */
function drawCoverPage(doc: PDFKit.PDFDocument, meta: LeasingMensuelleTemplateMeta) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = 48;

  // Bandeau supérieur
  doc.rect(0, 0, pageW, 120).fill(esayHex('navy'));

  const logoFile = logoPath();
  if (fs.existsSync(logoFile)) {
    doc.image(logoFile, margin, 36, { width: 120, height: 36, fit: [120, 36] });
  } else {
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('ESAY', margin, 48);
  }

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica')
    .fontSize(9)
    .text('LEASING IMPRIMANTES', margin, 78, { width: pageW - margin * 2, align: 'right' });

  // Titre principal
  const titleY = pageH * 0.32;
  doc
    .fillColor(esayHex('navy'))
    .font('Times-Bold')
    .fontSize(28)
    .text('Rapport Leasing Mensuel', margin, titleY, { width: pageW - margin * 2, align: 'center' });

  doc
    .fillColor(esayHex('blue'))
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(meta.mois ?? SAMPLE.mois, margin, titleY + 44, {
      width: pageW - margin * 2,
      align: 'center',
    });

  // Encadré informations client
  const boxY = pageH * 0.48;
  const boxH = 160;
  doc
    .roundedRect(margin, boxY, pageW - margin * 2, boxH, 6)
    .lineWidth(1)
    .strokeColor(esayHex('line'))
    .stroke();

  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('DOCUMENT CLIENT', margin + 20, boxY + 16);

  const info = [
    ['Client', meta.client ?? SAMPLE.client],
    ['Période', `${meta.periodeDebut ?? SAMPLE.periodeDebut} → ${meta.periodeFin ?? SAMPLE.periodeFin}`],
    ['Référence', meta.reference ?? SAMPLE.reference],
    ['Édition', new Date().toLocaleDateString('fr-FR')],
  ];

  let iy = boxY + 36;
  info.forEach(([label, value]) => {
    doc.fillColor(esayHex('muted')).font('Helvetica').fontSize(8).text(label, margin + 20, iy, { width: 80 });
    doc.fillColor(esayHex('ink')).font('Helvetica-Bold').fontSize(9.5).text(value, margin + 100, iy, {
      width: pageW - margin * 2 - 120,
    });
    iy += 26;
  });

  // Bandeau bas
  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(
      'Modèle de document — structure de référence pour les rapports mensuels de leasing.',
      margin,
      pageH - 80,
      { width: pageW - margin * 2, align: 'center' },
    );

  doc
    .moveTo(margin, pageH - 100)
    .lineTo(pageW - margin, pageH - 100)
    .strokeColor(esayHex('blue'))
    .lineWidth(2)
    .stroke();
}

function drawPageFooter(doc: PDFKit.PDFDocument, label: string) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = doc.page.margins.left;
  const range = doc.bufferedPageRange();
  const pageIndex = range.count - 1;

  doc
    .moveTo(margin, pageH - 40)
    .lineTo(pageW - margin, pageH - 40)
    .strokeColor(esayHex('line'))
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica')
    .fontSize(7)
    .text(`${label} · ESAY Corporation`, margin, pageH - 28, { width: pageW - margin * 2 - 60 });

  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica')
    .fontSize(7)
    .text(`Page ${pageIndex + 1}`, pageW - margin - 50, pageH - 28, { width: 50, align: 'right' });
}

function drawSectionHeading(
  doc: PDFKit.PDFDocument,
  y: number,
  number: string,
  title: string,
  subtitle?: string,
): number {
  const margin = doc.page.margins.left;
  const usableW = doc.page.width - margin - doc.page.margins.right;

  doc
    .fillColor(esayHex('blue'))
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(number.toUpperCase(), margin, y);

  doc
    .fillColor(esayHex('navy'))
    .font('Times-Bold')
    .fontSize(16)
    .text(title, margin, y + 12, { width: usableW });

  y = doc.y + 4;
  if (subtitle) {
    doc.fillColor(esayHex('muted')).font('Helvetica').fontSize(9).text(subtitle, margin, y, {
      width: usableW,
    });
    y = doc.y + 8;
  }

  doc
    .moveTo(margin, y + 2)
    .lineTo(margin + usableW, y + 2)
    .strokeColor(esayHex('blue'))
    .lineWidth(0.8)
    .stroke();

  return y + 14;
}

type Col = { key: string; header: string; width: number; align?: 'left' | 'center' | 'right' };

function drawTable(
  doc: PDFKit.PDFDocument,
  y: number,
  columns: Col[],
  rows: Array<Record<string, string | number>>,
  opts?: { rowH?: number; fontSize?: number },
): number {
  const margin = doc.page.margins.left;
  const usableW = doc.page.width - margin - doc.page.margins.right;
  const rowH = opts?.rowH ?? 20;
  const fontSize = opts?.fontSize ?? 8;
  const headerH = 24;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const scale = usableW / totalW;
  const cols = columns.map((c) => ({ ...c, width: c.width * scale }));
  const line = esayHex('line');

  const drawHead = () => {
    doc.rect(margin, y, usableW, headerH).fill('#FFFFFF');
    let x = margin;
    cols.forEach((col) => {
      doc
        .fillColor(esayHex('blue'))
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(col.header.toUpperCase(), x + 4, y + 8, { width: col.width - 8, align: col.align ?? 'left' });
      x += col.width;
    });
    doc
      .moveTo(margin, y + headerH)
      .lineTo(margin + usableW, y + headerH)
      .strokeColor(esayHex('blue'))
      .lineWidth(0.9)
      .stroke();
    y += headerH;
  };

  drawHead();

  rows.forEach((row, idx) => {
    const top = y;
    doc.rect(margin, top, usableW, rowH).fill(idx % 2 ? '#FAFBFC' : '#FFFFFF');
    doc
      .moveTo(margin, top + rowH)
      .lineTo(margin + usableW, top + rowH)
      .strokeColor(line)
      .lineWidth(0.4)
      .stroke();

    let x = margin;
    cols.forEach((col) => {
      doc
        .fillColor(esayHex('ink'))
        .font('Helvetica')
        .fontSize(fontSize)
        .text(String(row[col.key] ?? '—'), x + 4, top + 6, {
          width: col.width - 8,
          align: col.align ?? 'left',
        });
      x += col.width;
    });
    y += rowH;
  });

  return y + 10;
}

function drawSommaire(doc: PDFKit.PDFDocument, entries: TocEntry[]) {
  const margin = doc.page.margins.left;
  const pageW = doc.page.width;
  const usableW = pageW - margin - doc.page.margins.right;

  doc
    .fillColor(esayHex('navy'))
    .font('Times-Bold')
    .fontSize(22)
    .text('Sommaire', margin, 80, { width: usableW });

  doc
    .moveTo(margin, 118)
    .lineTo(margin + usableW, 118)
    .strokeColor(esayHex('blue'))
    .lineWidth(1.2)
    .stroke();

  let y = 140;
  entries.forEach((entry) => {
    const indent = entry.level === 2 ? 16 : 0;
    doc
      .fillColor(esayHex('ink'))
      .font(entry.level === 2 ? 'Helvetica' : 'Helvetica-Bold')
      .fontSize(entry.level === 2 ? 9 : 10)
      .text(entry.title, margin + indent, y, { width: usableW - 60 - indent });

    doc
      .fillColor(esayHex('blue'))
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(String(entry.page), pageW - margin - 40, y, { width: 40, align: 'right' });

    // pointillés
    const titleW = doc.widthOfString(entry.title);
    const dotsX = margin + indent + titleW + 8;
    const dotsW = pageW - margin - 48 - dotsX;
    if (dotsW > 20) {
      doc
        .fillColor(esayHex('line'))
        .font('Helvetica')
        .fontSize(8)
        .text('.'.repeat(Math.floor(dotsW / 4)), dotsX, y + 1, { width: dotsW, align: 'left' });
    }

    y += entry.level === 2 ? 20 : 26;
  });

  drawPageFooter(doc, 'Sommaire');
}

function drawAnnexePlaceholder(
  doc: PDFKit.PDFDocument,
  annexeNum: 1 | 2,
  item: AnnexeItem,
) {
  doc.addPage({ layout: 'portrait', margin: 48 });
  const margin = doc.page.margins.left;
  const pageW = doc.page.width;
  const usableW = pageW - margin - doc.page.margins.right;

  doc
    .fillColor(esayHex('navy'))
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`ANNEXE ${annexeNum}`, margin, 60);

  doc
    .fillColor(esayHex('ink'))
    .font('Times-Bold')
    .fontSize(14)
    .text(item.label, margin, 82, { width: usableW });

  doc.fillColor(esayHex('muted')).font('Helvetica').fontSize(9).text(item.subtitle, margin, 104, {
    width: usableW,
  });

  // Zone photo placeholder
  const photoY = 130;
  const photoH = doc.page.height - photoY - 80;
  doc
    .roundedRect(margin, photoY, usableW, photoH, 4)
    .lineWidth(1)
    .dash(6, { space: 4 })
    .strokeColor(esayHex('line'))
    .stroke()
    .undash();

  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica-Oblique')
    .fontSize(11)
    .text(
      annexeNum === 1
        ? '[ Emplacement photo / scan du compteur ]'
        : '[ Emplacement photo preuve d’intervention ]',
      margin,
      photoY + photoH / 2 - 20,
      { width: usableW, align: 'center' },
    );

  drawPageFooter(doc, `Annexe ${annexeNum}`);
}

export async function buildLeasingMensuelleTemplatePdf(
  meta: LeasingMensuelleTemplateMeta = {},
): Promise<Buffer> {
  const toc: TocEntry[] = [];
  const docLabel = meta.reference ?? SAMPLE.reference;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Modèle Rapport Leasing Mensuel — ${meta.mois ?? SAMPLE.mois}`,
        Author: 'ESAY Corporation',
        Subject: 'Modèle document client',
        Creator: 'ESAY Leasing — Template',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ——— Page de garde ———
    doc.addPage({ layout: 'portrait', margin: 48 });
    drawCoverPage(doc, meta);
    drawPageFooter(doc, 'Page de garde');

    // ——— Sommaire (page numbers filled after) ———
    const tocPageIndex = 1;

    // ——— Contenu ———
    doc.addPage({ layout: 'landscape', margin: 40 });
    const contentStartPage = 3;
    toc.push({ title: '1. Relevés compteurs par imprimante', page: contentStartPage });
    let y = 56;
    y = drawSectionHeading(
      doc,
      y,
      'Section 1',
      'Relevés compteurs par imprimante',
      'Index début / fin de période et différences consommées (N & Couleur)',
    );
    y = drawTable(
      doc,
      y,
      [
        { key: 'imprimante', header: 'Imprimante', width: 52 },
        { key: 'localisation', header: 'Localisation', width: 90 },
        { key: 'code', header: 'Relevé', width: 44 },
        { key: 'debutN', header: 'Début N', width: 48, align: 'right' },
        { key: 'debutC', header: 'Début C', width: 48, align: 'right' },
        { key: 'finN', header: 'Fin N', width: 48, align: 'right' },
        { key: 'finC', header: 'Fin C', width: 48, align: 'right' },
        { key: 'diffN', header: 'Δ N', width: 44, align: 'right' },
        { key: 'diffC', header: 'Δ C', width: 44, align: 'right' },
      ],
      SAMPLE.releves.map((r) => ({
        imprimante: r.imprimante,
        localisation: r.localisation,
        code: r.code,
        debutN: fmt(r.debutN),
        debutC: fmt(r.debutC),
        finN: fmt(r.finN),
        finC: fmt(r.finC),
        diffN: fmt(r.diffN),
        diffC: fmt(r.diffC),
      })),
    );
    drawPageFooter(doc, docLabel);

    // Section 2 — dépassement marge
    doc.addPage({ layout: 'landscape', margin: 40 });
    const s2Page = 4;
    toc.push({ title: '2. Copieurs ayant dépassé la marge incluse', page: s2Page });
    y = 56;
    y = drawSectionHeading(
      doc,
      y,
      'Section 2',
      'Copieurs ayant dépassé la marge incluse',
      'Quota mensuel dépassé — marge restante négative (copies à facturer)',
    );
    y = drawTable(
      doc,
      y,
      [
        { key: 'imprimante', header: 'Imprimante', width: 52 },
        { key: 'localisation', header: 'Localisation', width: 80 },
        { key: 'quotaN', header: 'Quota N', width: 44, align: 'right' },
        { key: 'quotaC', header: 'Quota C', width: 44, align: 'right' },
        { key: 'consoN', header: 'Conso N', width: 44, align: 'right' },
        { key: 'consoC', header: 'Conso C', width: 44, align: 'right' },
        { key: 'margeN', header: 'Marge rest. N', width: 52, align: 'right' },
        { key: 'margeC', header: 'Marge rest. C', width: 52, align: 'right' },
      ],
      SAMPLE.depassement.map((r) => ({
        imprimante: r.imprimante,
        localisation: r.localisation,
        quotaN: fmt(r.quotaN),
        quotaC: fmt(r.quotaC),
        consoN: fmt(r.consoN),
        consoC: fmt(r.consoC),
        margeN: fmt(r.margeRestanteN),
        margeC: fmt(r.margeRestanteC),
      })),
    );
    if (SAMPLE.depassement.length === 0) {
      doc.fillColor(esayHex('muted')).font('Helvetica-Oblique').fontSize(9).text('Aucun dépassement ce mois.', 40, y);
    }
    drawPageFooter(doc, docLabel);

    // Section 3 — sous marge + cumul
    doc.addPage({ layout: 'landscape', margin: 40 });
    const s3Page = 5;
    toc.push({ title: '3. Copieurs sous la marge incluse', page: s3Page });
    y = 56;
    y = drawSectionHeading(
      doc,
      y,
      'Section 3',
      'Copieurs n’ayant pas dépassé la marge incluse',
      'Marge restante par copieur et cumul du parc',
    );
    y = drawTable(
      doc,
      y,
      [
        { key: 'imprimante', header: 'Imprimante', width: 52 },
        { key: 'localisation', header: 'Localisation', width: 80 },
        { key: 'quotaN', header: 'Quota N', width: 44, align: 'right' },
        { key: 'quotaC', header: 'Quota C', width: 44, align: 'right' },
        { key: 'consoN', header: 'Conso N', width: 44, align: 'right' },
        { key: 'consoC', header: 'Conso C', width: 44, align: 'right' },
        { key: 'margeN', header: 'Marge rest. N', width: 52, align: 'right' },
        { key: 'margeC', header: 'Marge rest. C', width: 52, align: 'right' },
      ],
      SAMPLE.sousMarge.map((r) => ({
        imprimante: r.imprimante,
        localisation: r.localisation,
        quotaN: fmt(r.quotaN),
        quotaC: fmt(r.quotaC),
        consoN: fmt(r.consoN),
        consoC: fmt(r.consoC),
        margeN: fmt(r.margeRestanteN),
        margeC: fmt(r.margeRestanteC),
      })),
    );

    const cumulN = SAMPLE.sousMarge.reduce((s, r) => s + r.margeRestanteN, 0);
    const cumulC = SAMPLE.sousMarge.reduce((s, r) => s + r.margeRestanteC, 0);
    y += 8;
    doc
      .roundedRect(40, y, doc.page.width - 80, 36, 4)
      .fill(esayHex('paper'));
    doc
      .fillColor(esayHex('navy'))
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        `Cumul marge restante (parc sous quota) :  N ${fmt(cumulN)}  ·  Couleur ${fmt(cumulC)}`,
        52,
        y + 12,
        { width: doc.page.width - 104, align: 'center' },
      );
    drawPageFooter(doc, docLabel);

    // Section 4 — assistances
    doc.addPage({ layout: 'landscape', margin: 40 });
    const s4Page = 6;
    toc.push({ title: '4. Calendrier des assistances du mois', page: s4Page });
    y = 56;
    y = drawSectionHeading(
      doc,
      y,
      'Section 4',
      'Calendrier des assistances du mois',
      'Dates d’intervention par imprimante (1 assistance incluse / copieur / mois ; prélèvements et pannes hors quota)',
    );
    y = drawTable(
      doc,
      y,
      [
        { key: 'imprimante', header: 'Imprimante', width: 56 },
        { key: 'localisation', header: 'Localisation', width: 100 },
        { key: 'dates', header: 'Dates des assistances', width: 200 },
        { key: 'nb', header: 'Nb', width: 36, align: 'center' },
      ],
      SAMPLE.assistances.map((a) => ({
        imprimante: a.imprimante,
        localisation: a.localisation,
        dates: a.dates.join('  ·  '),
        nb: a.dates.length,
      })),
      { rowH: 28 },
    );
    drawPageFooter(doc, docLabel);

    // Annexes
    const annexe1Start = 7;
    toc.push({ title: 'Annexe 1 — Photos des compteurs', page: annexe1Start });
    toc.push({ title: 'Annexe 2 — Photos des interventions', page: annexe1Start + SAMPLE.annexeCompteurs.length });

    SAMPLE.annexeCompteurs.forEach((item) => drawAnnexePlaceholder(doc, 1, item));
    SAMPLE.annexeInterventions.forEach((item) => drawAnnexePlaceholder(doc, 2, item));

    // Insert sommaire page (page 2)
    doc.switchToPage(tocPageIndex);
    drawSommaire(doc, [{ title: 'Page de garde', page: 1 }, ...toc]);

    doc.end();
  });
}

/** Écrit le modèle PDF sur disque (assets/templates). */
export async function writeLeasingMensuelleTemplateFile(
  outPath?: string,
  meta?: LeasingMensuelleTemplateMeta,
): Promise<string> {
  const target =
    outPath ??
    path.join(process.cwd(), 'assets', 'templates', 'modele-leasing-mensuelle.pdf');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = await buildLeasingMensuelleTemplatePdf(meta);
  fs.writeFileSync(target, buffer);
  return target;
}
