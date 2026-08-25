import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatutFactureLigne,
  StatutFacturePeriode,
  TypeTarif,
} from '@prisma/client';
import { computeMontantLigne } from '../common/domain/calculs';
import { buildEsayWorkbook } from '../common/export/excel-builder';
import { buildEsayPdf } from '../common/export/pdf-builder';
import { PrismaService } from '../prisma/prisma.service';

const periodeInclude = {
  lignes: {
    include: { imprimante: { include: { marque: true } } },
    orderBy: { imprimante: { code: 'asc' as const } },
  },
} satisfies Prisma.FacturePeriodeInclude;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.facturePeriode.findMany({
      orderBy: { mois: 'desc' },
      include: { _count: { select: { lignes: true } } },
    });
  }

  async findByMois(mois: string) {
    this.assertMois(mois);
    const periode = await this.prisma.facturePeriode.findUnique({
      where: { mois },
      include: periodeInclude,
    });
    if (!periode) throw new NotFoundException(`Facture ${mois} introuvable`);
    return periode;
  }

  async calculate(mois: string) {
    this.assertMois(mois);
    await this.ensureNotClosed(mois);

    const tarifs = await this.loadTarifs();
    const releves = await this.prisma.releveCompteur.findMany({
      where: { moisFacture: mois },
      include: { imprimante: true },
      orderBy: { code: 'asc' },
    });

    if (releves.length === 0) {
      throw new BadRequestException(`Aucun releve pour ${mois}`);
    }

    const { debut, fin } = this.periodBounds(mois);
    const code = `FAC-${mois}`;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.facturePeriode.findUnique({ where: { mois } });
      if (existing?.statut === StatutFacturePeriode.CLOTUREE) {
        throw new BadRequestException(`Periode ${mois} cloturee`);
      }

      const periode = existing
        ? await tx.facturePeriode.update({
            where: { mois },
            data: {
              debutPeriode: debut,
              finPeriode: fin,
              prixNb: tarifs.prixNb,
              prixCouleur: tarifs.prixCouleur,
              prixScanNoir: tarifs.prixScanNoir,
              prixScanCouleur: tarifs.prixScanCouleur,
              prixEnvoi: tarifs.prixEnvoi,
              statut: StatutFacturePeriode.CALCULEE,
              lignes: { deleteMany: {} },
            },
          })
        : await tx.facturePeriode.create({
            data: {
              code,
              mois,
              debutPeriode: debut,
              finPeriode: fin,
              prixNb: tarifs.prixNb,
              prixCouleur: tarifs.prixCouleur,
              prixScanNoir: tarifs.prixScanNoir,
              prixScanCouleur: tarifs.prixScanCouleur,
              prixEnvoi: tarifs.prixEnvoi,
              statut: StatutFacturePeriode.CALCULEE,
            },
          });

      let montantTotal = new Prisma.Decimal(0);

      for (const r of releves) {
        const copiesNb = r.copiesNoirFacturer;
        const copiesCouleur = r.copiesCouleurFacturer;
        const scansNoir = r.scansNoirFacturer;
        const scansCouleur = r.scansCouleurFacturer;
        const envois = r.envoisFacturer;

        const amounts = computeMontantLigne({
          copiesNb,
          copiesCouleur,
          scansNoir,
          scansCouleur,
          envois,
          prixNb: Number(tarifs.prixNb),
          prixCouleur: Number(tarifs.prixCouleur),
          prixScanNoir: Number(tarifs.prixScanNoir),
          prixScanCouleur: Number(tarifs.prixScanCouleur),
          prixEnvoi: Number(tarifs.prixEnvoi),
        });
        const montantCopies = new Prisma.Decimal(amounts.montantCopies);
        const montantScans = new Prisma.Decimal(amounts.montantScans);
        const ligneTotal = new Prisma.Decimal(amounts.montantTotal);
        montantTotal = montantTotal.add(ligneTotal);

        const hasQty =
          copiesNb + copiesCouleur + scansNoir + scansCouleur + envois > 0;

        await tx.factureLigne.create({
          data: {
            periodeId: periode.id,
            imprimanteId: r.imprimanteId,
            nbReleves: 1,
            copiesNb,
            copiesCouleur,
            totalCopies: copiesNb + copiesCouleur,
            scansNoir,
            scansCouleur,
            envois,
            montantCopies,
            montantScans,
            montantTotal: ligneTotal,
            statut: hasQty
              ? StatutFactureLigne.A_FACTURER
              : StatutFactureLigne.AUCUNE_FACTURE,
          },
        });
      }

      return tx.facturePeriode.update({
        where: { id: periode.id },
        data: { montantTotal },
        include: periodeInclude,
      });
    });
  }

  async close(mois: string) {
    this.assertMois(mois);
    const periode = await this.prisma.facturePeriode.findUnique({
      where: { mois },
    });
    if (!periode) throw new NotFoundException(`Facture ${mois} introuvable`);
    if (periode.statut === StatutFacturePeriode.CLOTUREE) {
      throw new BadRequestException(`Periode ${mois} deja cloturee`);
    }
    if (periode.statut === StatutFacturePeriode.ANNULEE) {
      throw new BadRequestException(`Periode ${mois} annulee`);
    }
    if (periode.statut === StatutFacturePeriode.BROUILLON) {
      throw new BadRequestException('Calculer la periode avant cloture');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.factureLigne.updateMany({
        where: {
          periodeId: periode.id,
          statut: StatutFactureLigne.A_FACTURER,
        },
        data: { statut: StatutFactureLigne.FACTUREE },
      });

      await tx.campagneSaisie.updateMany({
        where: { mois },
        data: { cloturee: true },
      });

      return tx.facturePeriode.update({
        where: { id: periode.id },
        data: {
          statut: StatutFacturePeriode.CLOTUREE,
          clotureeAt: new Date(),
        },
        include: periodeInclude,
      });
    });
  }

  async export(mois: string, format: 'json' | 'csv' | 'xlsx' | 'pdf' = 'csv') {
    const periode = await this.findByMois(mois);

    if (format === 'json') return { kind: 'json' as const, data: periode };

    const mapped = periode.lignes.map((l) => ({
      imprimante: l.imprimante.code,
      localisation: l.imprimante.localisation ?? '',
      copiesNb: l.copiesNb,
      copiesCouleur: l.copiesCouleur,
      scansNoir: l.scansNoir,
      scansCouleur: l.scansCouleur,
      envois: l.envois,
      montantCopies: Number(l.montantCopies),
      montantScans: Number(l.montantScans),
      montantTotal: Number(l.montantTotal),
      statut: l.statut,
    }));

    if (format === 'xlsx') {
      const buffer = await buildEsayWorkbook([
        {
          title: `Facture ${periode.code}`,
          subtitle: `Période ${periode.mois} · ${periode.statut}`,
          meta: [
            { label: 'Total', value: `${Number(periode.montantTotal).toFixed(2)}` },
            { label: 'Lignes', value: String(periode.lignes.length) },
          ],
          columns: [
            { key: 'imprimante', header: 'Imprimante', width: 12 },
            { key: 'localisation', header: 'Localisation', width: 22 },
            { key: 'copiesNb', header: 'Copies N', width: 10, align: 'right' },
            { key: 'copiesCouleur', header: 'Copies C', width: 10, align: 'right' },
            { key: 'scansNoir', header: 'Scan N', width: 9, align: 'right' },
            { key: 'scansCouleur', header: 'Scan C', width: 9, align: 'right' },
            { key: 'envois', header: 'Envois', width: 9, align: 'right' },
            {
              key: 'montantCopies',
              header: 'Mt copies',
              width: 12,
              align: 'right',
              numFmt: '#,##0.00',
            },
            {
              key: 'montantScans',
              header: 'Mt scans',
              width: 12,
              align: 'right',
              numFmt: '#,##0.00',
            },
            {
              key: 'montantTotal',
              header: 'Mt total',
              width: 12,
              align: 'right',
              numFmt: '#,##0.00',
            },
            { key: 'statut', header: 'Statut', width: 12 },
          ],
          rows: mapped,
        },
      ]);
      return {
        kind: 'file' as const,
        filename: `facture-${mois}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    if (format === 'pdf') {
      const buffer = await buildEsayPdf({
        title: `Facture ${periode.code}`,
        subtitle: `Période ${periode.mois} · Total ${Number(periode.montantTotal).toFixed(2)}`,
        landscape: true,
        columns: [
          { key: 'imprimante', header: 'Imp.', width: 55 },
          { key: 'copiesNb', header: 'N', width: 42, align: 'right' },
          { key: 'copiesCouleur', header: 'C', width: 42, align: 'right' },
          { key: 'montantCopies', header: 'Mt copies', width: 60, align: 'right' },
          { key: 'montantScans', header: 'Mt scans', width: 55, align: 'right' },
          { key: 'montantTotal', header: 'Total', width: 60, align: 'right' },
          { key: 'statut', header: 'Statut', width: 70 },
        ],
        rows: mapped,
      });
      return {
        kind: 'file' as const,
        filename: `facture-${mois}.pdf`,
        mime: 'application/pdf',
        buffer,
      };
    }

    const header = [
      'code_periode',
      'mois',
      'imprimante',
      'copies_nb',
      'copies_couleur',
      'scans_noir',
      'scans_couleur',
      'envois',
      'montant_copies',
      'montant_scans',
      'montant_total',
      'statut_ligne',
    ].join(';');

    const rows = periode.lignes.map((l) =>
      [
        periode.code,
        periode.mois,
        l.imprimante.code,
        l.copiesNb,
        l.copiesCouleur,
        l.scansNoir,
        l.scansCouleur,
        l.envois,
        l.montantCopies.toString(),
        l.montantScans.toString(),
        l.montantTotal.toString(),
        l.statut,
      ].join(';'),
    );

    return {
      kind: 'csv' as const,
      mois,
      format: 'csv' as const,
      content: [header, ...rows].join('\n'),
      montantTotal: periode.montantTotal,
      statut: periode.statut,
    };
  }

  private async loadTarifs() {
    const rows = await this.prisma.tarifLeasing.findMany({
      where: { actif: true },
    });
    const map = new Map(rows.map((t) => [t.type, t.prixUnitaire]));
    const required = [
      TypeTarif.COPIE_NB,
      TypeTarif.COPIE_COULEUR,
      TypeTarif.SCAN_NOIR,
      TypeTarif.SCAN_COULEUR,
      TypeTarif.ENVOI,
    ];
    for (const type of required) {
      if (!map.has(type)) {
        throw new BadRequestException(`Tarif manquant: ${type}`);
      }
    }
    return {
      prixNb: map.get(TypeTarif.COPIE_NB)!,
      prixCouleur: map.get(TypeTarif.COPIE_COULEUR)!,
      prixScanNoir: map.get(TypeTarif.SCAN_NOIR)!,
      prixScanCouleur: map.get(TypeTarif.SCAN_COULEUR)!,
      prixEnvoi: map.get(TypeTarif.ENVOI)!,
    };
  }

  private async ensureNotClosed(mois: string) {
    const periode = await this.prisma.facturePeriode.findUnique({
      where: { mois },
    });
    if (periode?.statut === StatutFacturePeriode.CLOTUREE) {
      throw new BadRequestException(`Periode ${mois} cloturee`);
    }
  }

  private periodBounds(mois: string) {
    const [y, m] = mois.split('-').map(Number);
    const debut = new Date(Date.UTC(y, m - 1, 1));
    const fin = new Date(Date.UTC(y, m, 0));
    return { debut, fin };
  }

  private assertMois(mois: string) {
    if (!/^\d{4}-\d{2}$/.test(mois)) {
      throw new BadRequestException('Mois invalide (attendu YYYY-MM)');
    }
  }
}
