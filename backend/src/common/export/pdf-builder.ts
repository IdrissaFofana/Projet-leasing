import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { ESAY_EXPORT, esayHex } from './esay-theme';

export type PdfColumn = {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
};

export type PdfTableInput = {
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  columns: PdfColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  landscape?: boolean;
  footerNote?: string;
};

function logoPath() {
  return path.join(process.cwd(), 'assets', 'logo-esay.png');
}

function drawLogos(doc: PDFKit.PDFDocument) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const logoFile = logoPath();
  const logoW = 92;
  const logoH = 28;
  const y = 22;

  if (fs.existsSync(logoFile)) {
    doc.image(logoFile, margin, y, { width: logoW, height: logoH, fit: [logoW, logoH] });
    doc.image(logoFile, pageW - margin - logoW, y, {
      width: logoW,
      height: logoH,
      fit: [logoW, logoH],
    });
  } else {
    doc
      .fillColor(esayHex('navy'))
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('ESAY', margin, y + 6);
    doc
      .fillColor(esayHex('navy'))
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('ESAY', pageW - margin - 40, y + 6, { width: 40, align: 'right' });
  }

  return y + logoH + 14;
}

/** En-tête éditorial (comme page-head du front) : logos + titre + règle bleue. */
function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
  meta?: string,
) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const usableW = pageW - margin - doc.page.margins.right;

  let y = drawLogos(doc);

  // Centre brand line between logos
  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica')
    .fontSize(8)
    .text('LEASING IMPRIMANTES', margin + 100, 30, {
      width: usableW - 200,
      align: 'center',
    });

  doc
    .fillColor(esayHex('ink'))
    .font('Times-Bold')
    .fontSize(15)
    .text(title, margin, y, { width: usableW });
  y = doc.y + 3;

  if (subtitle) {
    doc
      .fillColor(esayHex('muted'))
      .font('Helvetica')
      .fontSize(8.5)
      .text(subtitle, margin, y, { width: usableW });
    y = doc.y + 2;
  }

  if (meta) {
    doc
      .fillColor(esayHex('muted'))
      .font('Helvetica')
      .fontSize(7.5)
      .text(meta, margin, y, { width: usableW });
    y = doc.y + 6;
  } else {
    y += 6;
  }

  // Blue rule like .page-head / .data-table th border
  doc
    .moveTo(margin, y)
    .lineTo(pageW - margin, y)
    .strokeColor(esayHex('blue'))
    .lineWidth(1)
    .stroke();

  return y + 10;
}

function drawFooter(doc: PDFKit.PDFDocument, note?: string) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = doc.page.margins.left;
  const bottom = pageH - 26;

  doc
    .moveTo(margin, bottom - 6)
    .lineTo(pageW - margin, bottom - 6)
    .strokeColor(esayHex('line'))
    .lineWidth(0.6)
    .stroke();

  doc
    .fillColor(esayHex('muted'))
    .font('Helvetica')
    .fontSize(7)
    .text(note ?? 'Document ESAY Corporation — généré automatiquement', margin, bottom - 2, {
      width: pageW - margin * 2 - 80,
    });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(esayHex('muted'))
      .font('Helvetica')
      .fontSize(7)
      .text(`Page ${i + 1} / ${range.count}`, pageW - margin - 70, bottom - 2, {
        width: 70,
        align: 'right',
      });
  }
}

function cellText(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/**
 * Tableau aligné sur le design front `.data-table` :
 * - en-têtes blancs, labels bleus uppercase
 * - bordure fine bleue sous le header
 * - lignes blanches / #FAFBFC
 * - séparateurs #E5E7EB
 */
export async function buildEsayPdf(input: PdfTableInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: input.landscape ? 'landscape' : 'portrait',
      margins: { top: 28, bottom: 36, left: 32, right: 32 },
      bufferPages: true,
      info: {
        Title: input.title,
        Author: 'ESAY Corporation',
        Creator: 'ESAY Leasing',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const meta = [
      ...(input.meta ?? []).map((m) => `${m.label}: ${m.value}`),
      `Exporté le ${new Date().toLocaleString('fr-FR')}`,
    ].join('   ·   ');

    let y = drawHeader(doc, input.title, input.subtitle, meta);
    const margin = doc.page.margins.left;
    const usableW = doc.page.width - margin - doc.page.margins.right;
    const totalColW = input.columns.reduce((s, c) => s + c.width, 0);
    const scale = usableW / totalColW;
    const cols = input.columns.map((c) => ({ ...c, width: c.width * scale }));
    const rowH = 18;
    const headerH = 22;
    const bottomLimit = doc.page.height - 48;
    const line = esayHex('line');
    const inkSoftRow = '#FAFBFC';

    const drawTableHeader = () => {
      // White header band (like .data-table th)
      doc.rect(margin, y, usableW, headerH).fill('#FFFFFF');

      let x = margin;
      cols.forEach((col) => {
        doc
          .fillColor(esayHex('blue'))
          .font('Helvetica-Bold')
          .fontSize(6.8)
          .text(col.header.toUpperCase(), x + 4, y + 7, {
            width: col.width - 8,
            align: col.align ?? 'left',
            characterSpacing: 0.6,
            lineBreak: false,
          });
        x += col.width;
      });

      // Bottom border mix blue + line
      doc
        .moveTo(margin, y + headerH)
        .lineTo(margin + usableW, y + headerH)
        .strokeColor(esayHex('blue'))
        .lineWidth(0.9)
        .stroke();

      // Outer box top/sides start
      doc
        .moveTo(margin, y)
        .lineTo(margin + usableW, y)
        .strokeColor(line)
        .lineWidth(0.5)
        .stroke();
      doc
        .moveTo(margin, y)
        .lineTo(margin, y + headerH)
        .strokeColor(line)
        .lineWidth(0.5)
        .stroke();
      doc
        .moveTo(margin + usableW, y)
        .lineTo(margin + usableW, y + headerH)
        .strokeColor(line)
        .lineWidth(0.5)
        .stroke();

      y += headerH;
    };

    const drawRowBox = (rowTop: number, h: number, fill?: string) => {
      if (fill) {
        doc.rect(margin, rowTop, usableW, h).fill(fill);
      }
      doc
        .moveTo(margin, rowTop + h)
        .lineTo(margin + usableW, rowTop + h)
        .strokeColor(line)
        .lineWidth(0.4)
        .stroke();
      doc
        .moveTo(margin, rowTop)
        .lineTo(margin, rowTop + h)
        .strokeColor(line)
        .lineWidth(0.4)
        .stroke();
      doc
        .moveTo(margin + usableW, rowTop)
        .lineTo(margin + usableW, rowTop + h)
        .strokeColor(line)
        .lineWidth(0.4)
        .stroke();
    };

    drawTableHeader();

    input.rows.forEach((row, idx) => {
      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = drawHeader(doc, input.title, input.subtitle, meta);
        drawTableHeader();
      }

      const rowTop = y;
      const alt = idx % 2 === 1;
      drawRowBox(rowTop, rowH, alt ? inkSoftRow : '#FFFFFF');

      let x = margin;
      cols.forEach((col) => {
        const val = cellText(row[col.key]);
        doc
          .fillColor(esayHex('ink'))
          .font('Helvetica')
          .fontSize(7.5)
          .text(val, x + 4, rowTop + 5, {
            width: col.width - 8,
            align: col.align ?? (typeof row[col.key] === 'number' ? 'right' : 'left'),
            lineBreak: false,
          });
        x += col.width;
      });

      y += rowH;
    });

    if (input.rows.length === 0) {
      doc
        .fillColor(esayHex('muted'))
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text('Aucune donnée à exporter', margin, y + 14);
    }

    drawFooter(doc, input.footerNote);
    doc.end();
  });
}
