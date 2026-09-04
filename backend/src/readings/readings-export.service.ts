import { BadRequestException, Injectable } from '@nestjs/common';
import { buildEsayWorkbook, type ExcelSheetInput } from '../common/export/excel-builder';
import type { PdfTableInput } from '../common/export/pdf-builder';
import { buildRelevesExportPdf } from '../common/export/releves-export-html.builder';
import { PrismaService } from '../prisma/prisma.service';
import { ReadingsService } from './readings.service';

export type ExportView = 'liste' | 'mensuelle' | 'controle' | 'matrice';
export type ExportFormat = 'xlsx' | 'pdf';

@Injectable()
export class ReadingsExportService {
  constructor(
    private readonly readings: ReadingsService,
    private readonly prisma: PrismaService,
  ) {}

  async export(params: {
    format: ExportFormat;
    view: ExportView;
    mois?: string;
    moisDebut?: string;
    moisFin?: string;
    metric?: 'compteurs' | 'delta' | 'facturer';
  }): Promise<{ filename: string; mime: string; buffer: Buffer }> {
    const { format, view } = params;
    if (format !== 'xlsx' && format !== 'pdf') {
      throw new BadRequestException('format invalide (xlsx|pdf)');
    }

    const sheet = await this.buildSheet(view, params);
    if (format === 'xlsx') {
      const buffer = await buildEsayWorkbook([sheet.excel]);
      return {
        filename: `${sheet.baseName}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    const client = await this.prisma.client.findFirst({
      orderBy: { nom: 'asc' },
      select: { nom: true },
    });

    const buffer = await buildRelevesExportPdf({
      title: sheet.pdf.title,
      subtitle: sheet.pdf.subtitle ?? '',
      note: sheet.note,
      sectionTag: sheet.sectionTag,
      sectionTitle: sheet.sectionTitle,
      client: client?.nom,
      reference: sheet.reference,
      mois: sheet.mois,
      moisDebut: sheet.moisDebut,
      moisFin: sheet.moisFin,
      meta: sheet.pdf.meta,
      columns: sheet.pdf.columns.map((c) => ({
        key: c.key,
        header: c.header,
        align: c.align,
      })),
      rows: sheet.pdf.rows,
    });

    return {
      filename: `${sheet.baseName}.pdf`,
      mime: 'application/pdf',
      buffer,
    };
  }

  private async buildSheet(
    view: ExportView,
    params: {
      mois?: string;
      moisDebut?: string;
      moisFin?: string;
      metric?: 'compteurs' | 'delta' | 'facturer';
    },
  ): Promise<{
    baseName: string;
    excel: ExcelSheetInput;
    pdf: PdfTableInput;
    reference: string;
    note?: string;
    sectionTag?: string;
    sectionTitle?: string;
    mois?: string;
    moisDebut?: string;
    moisFin?: string;
  }> {
    if (view === 'liste') {
      const mois = params.mois ?? this.currentMois();
      const rows = await this.readings.findAll({ mois });
      const mapped = rows.map((r) => ({
        code: r.code,
        imprimante: r.imprimante?.code ?? '',
        localisation: r.imprimante?.localisation ?? '',
        date: r.dateReleve.toISOString().slice(0, 10),
        totalN: r.totalNoir,
        totalC: r.totalCouleur,
        deltaN: r.copiesNoirDelta,
        deltaC: r.copiesCouleurDelta,
        inclusN: r.copiesNoirIncluses,
        inclusC: r.copiesCouleurIncluses,
        factN: r.copiesNoirFacturer,
        factC: r.copiesCouleurFacturer,
        reportN: r.quotaNoirReport,
        reportC: r.quotaCouleurReport,
        c501: r.c501,
        statut: r.statut,
      }));
      const columns = [
        { key: 'code', header: 'Code', width: 12 },
        { key: 'imprimante', header: 'Imprimante', width: 12 },
        { key: 'localisation', header: 'Localisation', width: 22 },
        { key: 'date', header: 'Date', width: 12 },
        { key: 'totalN', header: 'Total N', width: 10, align: 'right' as const },
        { key: 'totalC', header: 'Total C', width: 10, align: 'right' as const },
        { key: 'deltaN', header: 'Δ N', width: 9, align: 'right' as const },
        { key: 'deltaC', header: 'Δ C', width: 9, align: 'right' as const },
        { key: 'inclusN', header: 'Inclus N', width: 10, align: 'right' as const },
        { key: 'inclusC', header: 'Inclus C', width: 10, align: 'right' as const },
        { key: 'factN', header: 'Fact. N', width: 10, align: 'right' as const },
        { key: 'factC', header: 'Fact. C', width: 10, align: 'right' as const },
        { key: 'reportN', header: 'Report N', width: 10, align: 'right' as const },
        { key: 'reportC', header: 'Report C', width: 10, align: 'right' as const },
        { key: 'c501', header: '501 (scan)', width: 10, align: 'right' as const },
        { key: 'statut', header: 'Statut', width: 14 },
      ];
      return {
        baseName: `releves-liste-${mois}`,
        reference: `REL-LISTE-${mois}`,
        mois,
        sectionTag: 'Relevés',
        sectionTitle: 'Liste des relevés compteurs',
        note: 'Liste mensuelle des relevés avec quotas (1 000 N / 2 000 C + report) et copies facturables.',
        excel: {
          title: `Relevés compteurs — ${mois}`,
          subtitle: 'Liste mensuelle avec quotas (1 000 N / 2 000 C + report)',
          meta: [
            { label: 'Mois', value: mois },
            { label: 'Lignes', value: String(mapped.length) },
          ],
          columns,
          rows: mapped,
        },
        pdf: {
          title: 'Liste des relevés',
          subtitle: 'Liste mensuelle avec quotas et copies facturables',
          meta: [
            { label: 'Mois', value: mois },
            { label: 'Lignes', value: String(mapped.length) },
          ],
          landscape: true,
          columns: columns.map((c) => ({
            key: c.key,
            header: c.header,
            width: Math.max(28, (c.width ?? 10) * 4.2),
            align: c.align,
          })),
          rows: mapped,
        },
      };
    }

    if (view === 'mensuelle') {
      const mois = params.mois ?? this.currentMois();
      const data = await this.readings.monthlyView({ mois });
      const mapped = data.lignes.map((l) => ({
        imprimante: l.imprimante.code,
        localisation: l.imprimante.localisation ?? '',
        debutN: l.debut?.totalNoir ?? null,
        finN: l.fin.totalNoir,
        deltaN: l.delta.noir,
        factN: l.delta.noirFacturer ?? null,
        debutC: l.debut?.totalCouleur ?? null,
        finC: l.fin.totalCouleur,
        deltaC: l.delta.couleur,
        factC: l.delta.couleurFacturer ?? null,
        pctN: l.comparaison?.pctNoir ?? null,
        statut: l.fin.statut,
      }));
      const columns = [
        { key: 'imprimante', header: 'Imprimante', width: 12 },
        { key: 'localisation', header: 'Localisation', width: 20 },
        { key: 'debutN', header: 'Début N', width: 10, align: 'right' as const },
        { key: 'finN', header: 'Fin N', width: 10, align: 'right' as const },
        { key: 'deltaN', header: 'Δ N', width: 9, align: 'right' as const },
        { key: 'factN', header: 'Fact. N', width: 10, align: 'right' as const },
        { key: 'debutC', header: 'Début C', width: 10, align: 'right' as const },
        { key: 'finC', header: 'Fin C', width: 10, align: 'right' as const },
        { key: 'deltaC', header: 'Δ C', width: 9, align: 'right' as const },
        { key: 'factC', header: 'Fact. C', width: 10, align: 'right' as const },
        { key: 'pctN', header: '% vs M-1', width: 10, align: 'right' as const },
        { key: 'statut', header: 'Statut', width: 14 },
      ];
      return {
        baseName: `releves-mensuelle-${mois}`,
        reference: `REL-MENS-${mois}`,
        mois,
        sectionTag: 'Vue mensuelle',
        sectionTitle: 'Relevés par imprimante',
        note: `Totaux Δ N ${data.totaux.deltaNoir} · Δ C ${data.totaux.deltaCouleur}.`,
        excel: {
          title: `Vue mensuelle — ${mois}`,
          subtitle: `Totaux Δ N ${data.totaux.deltaNoir} · Δ C ${data.totaux.deltaCouleur}`,
          meta: [
            { label: 'Machines', value: String(data.totaux.nbImprimantes) },
            { label: 'Vs', value: data.moisPrecedent ?? '—' },
          ],
          columns,
          rows: mapped,
        },
        pdf: {
          title: 'Vue mensuelle des relevés',
          subtitle: `Δ N ${data.totaux.deltaNoir} · Δ C ${data.totaux.deltaCouleur}`,
          meta: [
            { label: 'Machines', value: String(data.totaux.nbImprimantes) },
            { label: 'Vs', value: data.moisPrecedent ?? '—' },
          ],
          landscape: true,
          columns: columns.map((c) => ({
            key: c.key,
            header: c.header,
            width: Math.max(32, (c.width ?? 10) * 4.5),
            align: c.align,
          })),
          rows: mapped,
        },
      };
    }

    if (view === 'controle') {
      const mois = params.mois ?? this.currentMois();
      const data = await this.readings.control(mois);
      const mapped = data.lignes.map((l) => ({
        code: l.code,
        imprimante: l.imprimante.code,
        localisation: l.imprimante.localisation ?? '',
        totalN: l.totalNoir,
        c501: l.c501,
        deltaN: l.copiesNoirBrutes,
        factN: l.copiesNoirFacturer,
        factC: l.copiesCouleurFacturer,
        motif: l.observationMotif ?? '',
        statut: l.statut,
        aTraiter: l.aTraiter ? 'Oui' : 'Non',
      }));
      const columns = [
        { key: 'code', header: 'Code', width: 12 },
        { key: 'imprimante', header: 'Imprimante', width: 12 },
        { key: 'localisation', header: 'Localisation', width: 20 },
        { key: 'totalN', header: 'Total N', width: 10, align: 'right' as const },
        { key: 'c501', header: '501', width: 9, align: 'right' as const },
        { key: 'deltaN', header: 'Δ N brut', width: 10, align: 'right' as const },
        { key: 'factN', header: 'Fact. N', width: 10, align: 'right' as const },
        { key: 'factC', header: 'Fact. C', width: 10, align: 'right' as const },
        { key: 'motif', header: 'Motif', width: 16 },
        { key: 'statut', header: 'Statut', width: 14 },
        { key: 'aTraiter', header: 'À traiter', width: 10, align: 'center' as const },
      ];
      return {
        baseName: `controle-releves-${mois}`,
        reference: `REL-CTRL-${mois}`,
        mois,
        sectionTag: 'Contrôle',
        sectionTitle: 'File de contrôle des relevés',
        note: `File d'anomalies et écarts — ${data.resume.aTraiter ?? 0} à traiter · ${data.resume.anomalies} anomalie(s).`,
        excel: {
          title: `Contrôle relevés — ${mois}`,
          subtitle: `${data.resume.aTraiter ?? 0} à traiter · ${data.resume.anomalies} anomalie(s)`,
          meta: [
            { label: 'Total', value: String(data.resume.total) },
            { label: 'Validés', value: String(data.resume.valides ?? 0) },
          ],
          columns,
          rows: mapped,
        },
        pdf: {
          title: 'Contrôle des relevés',
          subtitle: `File d'anomalies et écarts`,
          meta: [
            { label: 'Total', value: String(data.resume.total) },
            { label: 'À traiter', value: String(data.resume.aTraiter ?? 0) },
            { label: 'Anomalies', value: String(data.resume.anomalies) },
          ],
          landscape: true,
          columns: columns.map((c) => ({
            key: c.key,
            header: c.header,
            width: Math.max(30, (c.width ?? 10) * 4.3),
            align: c.align,
          })),
          rows: mapped,
        },
      };
    }

    if (view === 'matrice') {
      const moisFin = params.moisFin ?? params.mois ?? this.currentMois();
      const moisDebut = params.moisDebut ?? this.shiftMois(moisFin, -3);
      const metric = params.metric ?? 'compteurs';
      const data = await this.readings.matrix(moisDebut, moisFin);
      const metricLabel =
        metric === 'delta'
          ? 'consommation (Δ N / Δ C)'
          : metric === 'facturer'
            ? 'facturable après quota (F N / F C)'
            : 'compteurs (total N / total C)';

      const cellLabel = (
        c: {
          totalNoir: number;
          totalCouleur: number;
          deltaNoir: number;
          deltaCouleur: number;
          facturerNoir: number;
          facturerCouleur: number;
        } | null,
      ) => {
        if (!c) return '—';
        if (metric === 'delta') return `${c.deltaNoir} / ${c.deltaCouleur}`;
        if (metric === 'facturer') return `${c.facturerNoir} / ${c.facturerCouleur}`;
        return `${c.totalNoir} / ${c.totalCouleur}`;
      };

      const mapped = data.lignes.map((l) => {
        const row: Record<string, string | number | null> = {
          imprimante: l.imprimante.code,
          localisation: l.imprimante.localisation ?? '',
        };
        for (const m of data.mois) {
          row[m] = cellLabel(l.cellules[m]);
        }
        return row;
      });

      const columns: ExcelSheetInput['columns'] = [
        { key: 'imprimante', header: 'Imprimante', width: 12 },
        { key: 'localisation', header: 'Localisation', width: 24 },
        ...data.mois.map((m) => ({
          key: m,
          header: m,
          width: 14,
          align: 'center' as const,
        })),
      ];

      const monthColW = Math.max(48, Math.min(72, Math.floor(520 / Math.max(data.mois.length, 1))));

      return {
        baseName: `matrice-releves-${moisDebut}_${moisFin}`,
        reference: `REL-MAT-${moisDebut}_${moisFin}`,
        moisDebut,
        moisFin,
        sectionTag: 'Matrice',
        sectionTitle: 'Parc × mois',
        note: `Quota base ${data.quotaBase.noir} N / ${data.quotaBase.couleur} C · affichage ${metricLabel}.`,
        excel: {
          title: `Matrice parc — ${moisDebut} → ${moisFin}`,
          subtitle: `Quota base ${data.quotaBase.noir} N / ${data.quotaBase.couleur} C · ${data.lignes.length} imprimantes`,
          meta: [
            { label: 'Période', value: `${moisDebut} → ${moisFin}` },
            { label: 'Affichage', value: metricLabel },
          ],
          columns,
          rows: mapped,
        },
        pdf: {
          title: 'Matrice parc des relevés',
          subtitle: `Parc × mois — ${metricLabel}`,
          meta: [
            { label: 'Période', value: `${moisDebut} → ${moisFin}` },
            { label: 'Affichage', value: metricLabel },
            { label: 'Imprimantes', value: String(data.lignes.length) },
          ],
          landscape: true,
          columns: [
            { key: 'imprimante', header: 'Imprimante', width: 58 },
            { key: 'localisation', header: 'Localisation', width: 110 },
            ...data.mois.map((m) => ({
              key: m,
              header: m,
              width: monthColW,
              align: 'center' as const,
            })),
          ],
          rows: mapped,
        },
      };
    }

    throw new BadRequestException('view invalide (liste|mensuelle|controle|matrice)');
  }

  private currentMois() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private shiftMois(mois: string, delta: number) {
    const [y, m] = mois.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
