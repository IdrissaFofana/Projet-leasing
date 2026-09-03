import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import PDFDocumentKit from 'pdfkit';
import { absoluteUploadPath } from '../upload/report-files';
import { esayHex } from './esay-theme';
import { drawFooter, drawHeader, type PdfColumn } from './pdf-builder';

export type ReportAttachment = {
  label: string;
  subtitle?: string;
  relativePath: string;
  mime: string | null;
  originalName: string | null;
};

export type LeasingMensuelleReportData = {
  mois: string;
  campagne: {
    mois: string;
    dateReleve: string;
    portee: string;
    cloturee: boolean;
    lignes: Array<{
      imprimante: string;
      localisation: string;
      c112: number | null;
      c113: number | null;
      c122: number | null;
      c123: number | null;
      c501: number | null;
      statut: string;
      liee: boolean;
      codeReleve: string | null;
    }>;
  } | null;
  releves: Array<{
    code: string;
    imprimante: string;
    localisation: string;
    statut: string;
    c112: number;
    c113: number;
    c122: number;
    c123: number;
    c501: number | null;
    deltaN: number;
    deltaC: number;
    factN: number;
    factC: number;
    motif: string;
    totalNoir?: number;
    totalCouleur?: number;
    ancienTotalNoir?: number | null;
    ancienTotalCouleur?: number | null;
    quotaNoirDispo?: number;
    quotaCouleurDispo?: number;
    quotaNoirReport?: number;
    quotaCouleurReport?: number;
    attachment: ReportAttachment | null;
  }>;
  facture: {
    code: string;
    statut: string;
    montantTotal: number;
    prixNb: number;
    prixCouleur: number;
    lignes: Array<{
      imprimante: string;
      localisation: string;
      copiesNb: number;
      copiesCouleur: number;
      scansNoir: number;
      scansCouleur: number;
      envois: number;
      montantCopies: number;
      montantScans: number;
      montantTotal: number;
      statut: string;
    }>;
  } | null;
  maintenances: Array<{
    code: string;
    type: string;
    date: string;
    horsQuota?: boolean;
    imprimante: string;
    localisation: string;
    copieurs?: Array<{ code: string; localisation: string }>;
    actions: string;
    releveCode: string | null;
    attachment: ReportAttachment | null;
  }>;
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif']);

function cell(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtMoney(n: number) {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} XOF`;
}

function fmtDate(d: string | Date) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-FR');
}

type TableCtx = {
  doc: PDFKit.PDFDocument;
  margin: number;
  usableW: number;
  bottomLimit: number;
  docTitle: string;
  docSubtitle?: string;
  docMeta: string;
};

function ensureSpace(ctx: TableCtx, y: number, need: number): number {
  if (y + need <= ctx.bottomLimit) return y;
  ctx.doc.addPage({ layout: 'landscape' });
  return drawHeader(ctx.doc, ctx.docTitle, ctx.docSubtitle, ctx.docMeta);
}

function drawSectionTitle(ctx: TableCtx, y: number, title: string, subtitle?: string) {
  y = ensureSpace(ctx, y, 36);
  ctx.doc
    .fillColor(esayHex('navy'))
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, ctx.margin, y, { width: ctx.usableW });
  y = ctx.doc.y + 4;
  if (subtitle) {
    ctx.doc
      .fillColor(esayHex('muted'))
      .font('Helvetica')
      .fontSize(8)
      .text(subtitle, ctx.margin, y, { width: ctx.usableW });
    y = ctx.doc.y + 6;
  } else {
    y += 4;
  }
  return y;
}

function drawTable(
  ctx: TableCtx,
  y: number,
  columns: PdfColumn[],
  rows: Array<Record<string, string | number | null | undefined>>,
): number {
  const totalColW = columns.reduce((s, c) => s + c.width, 0);
  const scale = ctx.usableW / totalColW;
  const cols = columns.map((c) => ({ ...c, width: c.width * scale }));
  const rowH = 18;
  const headerH = 22;
  const line = esayHex('line');

  const drawHeaderRow = () => {
    ctx.doc.rect(ctx.margin, y, ctx.usableW, headerH).fill('#FFFFFF');
    let x = ctx.margin;
    cols.forEach((col) => {
      ctx.doc
        .fillColor(esayHex('blue'))
        .font('Helvetica-Bold')
        .fontSize(6.8)
        .text(col.header.toUpperCase(), x + 4, y + 7, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
        });
      x += col.width;
    });
    ctx.doc
      .moveTo(ctx.margin, y + headerH)
      .lineTo(ctx.margin + ctx.usableW, y + headerH)
      .strokeColor(esayHex('blue'))
      .lineWidth(0.9)
      .stroke();
    y += headerH;
  };

  y = ensureSpace(ctx, y, headerH + rowH);
  drawHeaderRow();

  rows.forEach((row, idx) => {
    if (y + rowH > ctx.bottomLimit) {
      ctx.doc.addPage({ layout: 'landscape' });
      y = drawHeader(ctx.doc, ctx.docTitle, ctx.docSubtitle, ctx.docMeta);
      y = ensureSpace(ctx, y, headerH + rowH);
      drawHeaderRow();
    }
    const rowTop = y;
    const fill = idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF';
    ctx.doc.rect(ctx.margin, rowTop, ctx.usableW, rowH).fill(fill);
    ctx.doc
      .moveTo(ctx.margin, rowTop + rowH)
      .lineTo(ctx.margin + ctx.usableW, rowTop + rowH)
      .strokeColor(line)
      .lineWidth(0.4)
      .stroke();

    let x = ctx.margin;
    cols.forEach((col) => {
      ctx.doc
        .fillColor(esayHex('ink'))
        .font('Helvetica')
        .fontSize(7.5)
        .text(cell(row[col.key]), x + 4, rowTop + 5, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
        });
      x += col.width;
    });
    y += rowH;
  });

  if (rows.length === 0) {
    ctx.doc
      .fillColor(esayHex('muted'))
      .font('Helvetica-Oblique')
      .fontSize(8.5)
      .text('Aucune donnée', ctx.margin, y + 6);
    y += 22;
  }

  return y + 8;
}

function embedImagePage(
  ctx: TableCtx,
  attachment: ReportAttachment,
  sectionLabel: string,
): void {
  const abs = absoluteUploadPath(attachment.relativePath);
  if (!fs.existsSync(abs)) return;

  ctx.doc.addPage({ layout: 'portrait' });
  const margin = ctx.doc.page.margins.left;
  const usableW = ctx.doc.page.width - margin - ctx.doc.page.margins.right;
  let y = drawHeader(
    ctx.doc,
    'Annexe — Pièce jointe',
    `${sectionLabel} · ${attachment.label}`,
    attachment.subtitle ?? attachment.originalName ?? '',
  );
  const maxH = ctx.doc.page.height - y - 56;

  try {
    ctx.doc.image(abs, margin, y, {
      fit: [usableW, maxH],
      align: 'center',
    });
  } catch {
    ctx.doc
      .fillColor(esayHex('muted'))
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text('Image non intégrable (format non supporté par le PDF).', margin, y + 12);
  }
}

async function buildMainPdf(data: LeasingMensuelleReportData): Promise<{
  buffer: Buffer;
  pdfAnnexes: Array<{ path: string; label: string }>;
}> {
  const pdfAnnexes: Array<{ path: string; label: string }> = [];

  const collectAttachment = (att: ReportAttachment | null, section: string) => {
    if (!att?.relativePath) return;
    const abs = absoluteUploadPath(att.relativePath);
    if (!fs.existsSync(abs)) return;
    const mime = att.mime ?? '';
    if (mime === 'application/pdf') {
      pdfAnnexes.push({ path: abs, label: `${section} — ${att.label}` });
    }
  };

  return new Promise((resolve, reject) => {
    const docTitle = `Rapport Leasing Mensuel — ${data.mois}`;
    const docSubtitle = 'Campagne · Relevés · Facturation · Maintenance';
    const docMeta = [
      `Généré le ${new Date().toLocaleString('fr-FR')}`,
      data.campagne ? `Campagne ${data.campagne.cloturee ? 'clôturée' : 'ouverte'}` : 'Sans campagne',
      data.facture ? `Facture ${data.facture.code} (${data.facture.statut})` : 'Facture non calculée',
    ].join('   ·   ');

    const doc = new PDFDocumentKit({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 28, bottom: 36, left: 32, right: 32 },
      bufferPages: true,
      info: {
        Title: docTitle,
        Author: 'ESAY Corporation',
        Creator: 'ESAY Leasing — Rapport mensuel',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pdfAnnexes }));
    doc.on('error', reject);

    const margin = doc.page.margins.left;
    const usableW = doc.page.width - margin - doc.page.margins.right;
    const bottomLimit = doc.page.height - 48;
    const ctx: TableCtx = {
      doc,
      margin,
      usableW,
      bottomLimit,
      docTitle,
      docSubtitle,
      docMeta,
    };

    let y = drawHeader(doc, docTitle, docSubtitle, docMeta);

    // Synthèse
    y = drawSectionTitle(ctx, y, 'Synthèse du mois');
    const synthRows = [
      { indicateur: 'Relevés officiels', valeur: data.releves.length },
      { indicateur: 'Lignes campagne', valeur: data.campagne?.lignes.length ?? 0 },
      { indicateur: 'Interventions maintenance', valeur: data.maintenances.length },
      {
        indicateur: 'Montant facturation',
        valeur: data.facture ? fmtMoney(data.facture.montantTotal) : '—',
      },
    ];
    y = drawTable(
      ctx,
      y,
      [
        { key: 'indicateur', header: 'Indicateur', width: 200 },
        { key: 'valeur', header: 'Valeur', width: 120, align: 'right' },
      ],
      synthRows,
    );

    // Campagne
    y = drawSectionTitle(
      ctx,
      y,
      '1. Campagne de saisie',
      data.campagne
        ? `Mois ${data.campagne.mois} · relève ${data.campagne.dateReleve} · ${data.campagne.portee}`
        : 'Aucune campagne enregistrée pour ce mois',
    );
    if (data.campagne) {
      y = drawTable(
        ctx,
        y,
        [
          { key: 'imprimante', header: 'Copieur', width: 52 },
          { key: 'localisation', header: 'Localisation', width: 90 },
          { key: 'c112', header: 'Noir G', width: 38, align: 'right' },
          { key: 'c113', header: 'Noir P', width: 38, align: 'right' },
          { key: 'c122', header: 'Couleur G', width: 38, align: 'right' },
          { key: 'c123', header: 'Couleur P', width: 38, align: 'right' },
          { key: 'c501', header: '501', width: 38, align: 'right' },
          { key: 'statut', header: 'Statut', width: 56 },
          { key: 'releve', header: 'Relevé', width: 52 },
        ],
        data.campagne.lignes.map((l) => ({
          imprimante: l.imprimante,
          localisation: l.localisation,
          c112: l.c112,
          c113: l.c113,
          c122: l.c122,
          c123: l.c123,
          c501: l.c501,
          statut: l.statut,
          releve: l.liee ? l.codeReleve ?? 'LIÉ' : '—',
        })),
      );
    }

    // Relevés
    y = drawSectionTitle(
      ctx,
      y,
      '2. Relevés compteurs (officiels)',
      'Deltas consommation et copies facturables après quota',
    );
    y = drawTable(
      ctx,
      y,
      [
        { key: 'code', header: 'Code', width: 48 },
        { key: 'imprimante', header: 'Copieur', width: 48 },
        { key: 'localisation', header: 'Localisation', width: 72 },
        { key: 'c112', header: 'Noir G', width: 36, align: 'right' },
        { key: 'c113', header: 'Noir P', width: 36, align: 'right' },
        { key: 'c122', header: 'Couleur G', width: 36, align: 'right' },
        { key: 'c123', header: 'Couleur P', width: 36, align: 'right' },
        { key: 'c501', header: '501', width: 36, align: 'right' },
        { key: 'deltaN', header: 'Δ N', width: 36, align: 'right' },
        { key: 'deltaC', header: 'Δ C', width: 36, align: 'right' },
        { key: 'factN', header: 'Fact. N', width: 36, align: 'right' },
        { key: 'factC', header: 'Fact. C', width: 36, align: 'right' },
        { key: 'statut', header: 'Statut', width: 52 },
        { key: 'pj', header: 'PJ', width: 28, align: 'center' },
      ],
      data.releves.map((r) => ({
        code: r.code,
        imprimante: r.imprimante,
        localisation: r.localisation,
        c112: r.c112,
        c113: r.c113,
        c122: r.c122,
        c123: r.c123,
        c501: r.c501,
        deltaN: r.deltaN,
        deltaC: r.deltaC,
        factN: r.factN,
        factC: r.factC,
        statut: r.statut,
        pj: r.attachment ? 'Oui' : '—',
      })),
    );

    for (const r of data.releves) {
      collectAttachment(r.attachment, `Relevé ${r.code}`);
      if (r.attachment && IMAGE_MIMES.has(r.attachment.mime ?? '')) {
        embedImagePage(ctx, r.attachment, `Relevé ${r.code} — ${r.imprimante}`);
      }
    }

    // Facturation
    y = drawSectionTitle(
      ctx,
      y,
      '3. Facturation',
      data.facture
        ? `${data.facture.code} · ${data.facture.statut} · Total ${fmtMoney(data.facture.montantTotal)}`
        : 'Facture non calculée pour ce mois',
    );
    if (data.facture) {
      y = drawTable(
        ctx,
        y,
        [
          { key: 'imprimante', header: 'Copieur', width: 52 },
          { key: 'localisation', header: 'Localisation', width: 80 },
          { key: 'copiesNb', header: 'Copies N', width: 44, align: 'right' },
          { key: 'copiesCouleur', header: 'Copies C', width: 44, align: 'right' },
          { key: 'scansNoir', header: 'Scan N', width: 40, align: 'right' },
          { key: 'scansCouleur', header: 'Scan C', width: 40, align: 'right' },
          { key: 'envois', header: 'Envois', width: 40, align: 'right' },
          { key: 'montantCopies', header: 'Mont. copies', width: 56, align: 'right' },
          { key: 'montantScans', header: 'Mont. scans', width: 56, align: 'right' },
          { key: 'montantTotal', header: 'Total', width: 56, align: 'right' },
          { key: 'statut', header: 'Statut', width: 48 },
        ],
        data.facture.lignes.map((l) => ({
          imprimante: l.imprimante,
          localisation: l.localisation,
          copiesNb: l.copiesNb,
          copiesCouleur: l.copiesCouleur,
          scansNoir: l.scansNoir,
          scansCouleur: l.scansCouleur,
          envois: l.envois,
          montantCopies: fmtMoney(l.montantCopies),
          montantScans: fmtMoney(l.montantScans),
          montantTotal: fmtMoney(l.montantTotal),
          statut: l.statut,
        })),
      );
    }

    // Maintenance
    y = drawSectionTitle(
      ctx,
      y,
      '4. Maintenance & assistances du mois',
      `${data.maintenances.length} intervention(s)`,
    );
    y = drawTable(
      ctx,
      y,
      [
        { key: 'code', header: 'Code', width: 48 },
        { key: 'type', header: 'Type', width: 52 },
        { key: 'date', header: 'Date', width: 52 },
        { key: 'imprimante', header: 'Copieur', width: 48 },
        { key: 'localisation', header: 'Localisation', width: 72 },
        { key: 'actions', header: 'Actions', width: 120 },
        { key: 'releve', header: 'Relevé', width: 48 },
        { key: 'pj', header: 'PJ', width: 28, align: 'center' },
      ],
      data.maintenances.map((m) => ({
        code: m.code,
        type: m.type,
        date: m.date,
        imprimante: m.imprimante,
        localisation: m.localisation,
        actions: m.actions,
        releve: m.releveCode ?? '—',
        pj: m.attachment ? 'Oui' : '—',
      })),
    );

    for (const m of data.maintenances) {
      collectAttachment(m.attachment, `Maintenance ${m.code}`);
      if (m.attachment && IMAGE_MIMES.has(m.attachment.mime ?? '')) {
        embedImagePage(ctx, m.attachment, `${m.type} ${m.code} — ${m.imprimante}`);
      }
    }

    drawFooter(
      doc,
      'Rapport Leasing Mensuel ESAY — campagne, relevés, facturation et maintenance · pièces jointes en annexes',
    );
    doc.end();
  });
}

async function mergePdfAnnexes(
  mainBuffer: Buffer,
  annexes: Array<{ path: string; label: string }>,
): Promise<Buffer> {
  if (annexes.length === 0) return mainBuffer;

  const merged = await PDFDocument.load(mainBuffer);

  for (const ann of annexes) {
    if (!fs.existsSync(ann.path)) continue;
    try {
      const annexDoc = await PDFDocument.load(fs.readFileSync(ann.path));
      const pages = await merged.copyPages(annexDoc, annexDoc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch {
      /* ignore unreadable pdf annex */
    }
  }

  return Buffer.from(await merged.save());
}

export async function buildLeasingMensuellePdf(
  data: LeasingMensuelleReportData,
): Promise<Buffer> {
  const { buffer, pdfAnnexes } = await buildMainPdf(data);
  return mergePdfAnnexes(buffer, pdfAnnexes);
}
