import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { ESAY_EXPORT } from './esay-theme';

export type ExcelColumn = {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
};

export type ExcelSheetInput = {
  title: string;
  subtitle?: string;
  meta?: Array<{ label: string; value: string }>;
  columns: ExcelColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  footerNote?: string;
};

const ROW_ALT = 'FAFBFC';

function logoFilePath() {
  return path.join(process.cwd(), 'assets', 'logo-esay.png');
}

function argb(hex: string) {
  return `FF${hex}`;
}

function paintRow(ws: ExcelJS.Worksheet, row: number, colCount: number, color: string) {
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(row, c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(color) },
    };
  }
}

/**
 * Mise en page alignée sur le PDF / `.data-table` :
 * logos gauche + droite, en-tête blanc, headers bleus uppercase, lignes #FAFBFC.
 */
export async function buildEsayWorkbook(sheets: ExcelSheetInput[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESAY Leasing';
  wb.created = new Date();
  wb.company = 'ESAY Corporation';

  let logoId: number | null = null;
  const logoPath = logoFilePath();
  if (fs.existsSync(logoPath)) {
    logoId = wb.addImage({
      buffer: fs.readFileSync(logoPath) as unknown as ExcelJS.Buffer,
      extension: 'png',
    });
  }

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.title.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
      properties: { defaultRowHeight: 18 },
      pageSetup: {
        orientation: sheet.columns.length > 8 ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    const colCount = Math.max(sheet.columns.length, 4);

    // —— Ligne logos (fond blanc) ——
    paintRow(ws, 1, colCount, ESAY_EXPORT.white);
    ws.getRow(1).height = 42;
    ws.mergeCells(1, 1, 1, colCount);

    if (logoId !== null) {
      const logoW = 118;
      const logoH = 36;
      // Gauche
      ws.addImage(logoId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: logoW, height: logoH },
        editAs: 'oneCell',
      });
      // Droite — ancré près de la dernière colonne
      const rightCol = Math.max(colCount - 2.2, 1.5);
      ws.addImage(logoId, {
        tl: { col: rightCol, row: 0.15 },
        ext: { width: logoW, height: logoH },
        editAs: 'oneCell',
      });
    } else {
      const brand = ws.getCell(1, 1);
      brand.value = 'ESAY';
      brand.font = {
        name: 'Calibri',
        size: 14,
        bold: true,
        color: { argb: argb(ESAY_EXPORT.navy) },
      };
      brand.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }

    // Ligne centrale entre logos
    const center = ws.getCell(1, 1);
    if (logoId !== null) {
      center.value = 'LEASING IMPRIMANTES';
      center.font = {
        name: 'Calibri',
        size: 9,
        color: { argb: argb(ESAY_EXPORT.muted) },
      };
      center.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // —— Titre ——
    ws.mergeCells(2, 1, 2, colCount);
    const title = ws.getCell(2, 1);
    title.value = sheet.title;
    title.font = {
      name: 'Calibri',
      size: 16,
      bold: true,
      color: { argb: argb(ESAY_EXPORT.ink) },
    };
    title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    paintRow(ws, 2, colCount, ESAY_EXPORT.white);
    ws.getRow(2).height = 26;

    // —— Sous-titre / méta ——
    ws.mergeCells(3, 1, 3, colCount);
    const sub = ws.getCell(3, 1);
    sub.value = [
      sheet.subtitle,
      ...(sheet.meta ?? []).map((m) => `${m.label}: ${m.value}`),
      `Exporté le ${new Date().toLocaleString('fr-FR')}`,
    ]
      .filter(Boolean)
      .join('   ·   ');
    sub.font = {
      name: 'Calibri',
      size: 9,
      color: { argb: argb(ESAY_EXPORT.muted) },
    };
    sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    paintRow(ws, 3, colCount, ESAY_EXPORT.white);
    ws.getRow(3).height = 20;

    // —— Règle bleue (comme .page-head / PDF) ——
    paintRow(ws, 4, colCount, ESAY_EXPORT.blue);
    ws.getRow(4).height = 3;

    // Espace
    paintRow(ws, 5, colCount, ESAY_EXPORT.white);
    ws.getRow(5).height = 8;

    // —— En-têtes colonnes (style .data-table th) ——
    const headerRowIdx = 6;
    const headerRow = ws.getRow(headerRowIdx);
    sheet.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header.toUpperCase();
      cell.font = {
        name: 'Calibri',
        size: 9,
        bold: true,
        color: { argb: argb(ESAY_EXPORT.blue) },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align ?? 'left',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(ESAY_EXPORT.white) },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: argb(ESAY_EXPORT.line) } },
        bottom: { style: 'medium', color: { argb: argb(ESAY_EXPORT.blue) } },
        left: { style: 'hair', color: { argb: argb(ESAY_EXPORT.line) } },
        right: { style: 'hair', color: { argb: argb(ESAY_EXPORT.line) } },
      };
      ws.getColumn(i + 1).width = col.width ?? 14;
    });
    headerRow.height = 24;

    // —— Données ——
    sheet.rows.forEach((row, rIdx) => {
      const excelRow = ws.getRow(headerRowIdx + 1 + rIdx);
      const alt = rIdx % 2 === 1;
      sheet.columns.forEach((col, cIdx) => {
        const cell = excelRow.getCell(cIdx + 1);
        const raw = row[col.key];
        cell.value = raw === null || raw === undefined || raw === '' ? '—' : raw;
        cell.font = {
          name: 'Calibri',
          size: 10,
          color: { argb: argb(ESAY_EXPORT.ink) },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: col.align ?? (typeof raw === 'number' ? 'right' : 'left'),
        };
        if (col.numFmt && typeof raw === 'number') cell.numFmt = col.numFmt;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: argb(alt ? ROW_ALT : ESAY_EXPORT.white) },
        };
        cell.border = {
          bottom: { style: 'hair', color: { argb: argb(ESAY_EXPORT.line) } },
          left: { style: 'hair', color: { argb: argb(ESAY_EXPORT.line) } },
          right: { style: 'hair', color: { argb: argb(ESAY_EXPORT.line) } },
        };
      });
      excelRow.height = 18;
    });

    // —— Pied ——
    const footerRow = headerRowIdx + 1 + sheet.rows.length + 1;
    ws.mergeCells(footerRow, 1, footerRow, colCount);
    const foot = ws.getCell(footerRow, 1);
    foot.value =
      sheet.footerNote ??
      'Document généré automatiquement — ESAY Corporation · Système de suivi leasing';
    foot.font = {
      name: 'Calibri',
      size: 8,
      italic: true,
      color: { argb: argb(ESAY_EXPORT.muted) },
    };
    foot.alignment = { horizontal: 'left', indent: 1 };

    const endData = headerRowIdx + sheet.rows.length;
    if (sheet.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRowIdx, column: 1 },
        to: { row: endData, column: colCount },
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
