import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import {

  buildLeasingMensuelleHtmlPdf,

  buildLeasingMensuelleSamplePdf,

  writeLeasingMensuelleHtmlSampleFile,

} from '../common/export/leasing-mensuelle-html.builder';

import {

  type LeasingMensuelleReportData,

  type ReportAttachment,

} from '../common/export/monthly-leasing-report.builder';

import { PrismaService } from '../prisma/prisma.service';



const factureInclude = {

  lignes: {

    include: { imprimante: true },

    orderBy: { imprimante: { code: 'asc' as const } },

  },

} satisfies Prisma.FacturePeriodeInclude;



@Injectable()

export class MonthlyReportService {

  constructor(private readonly prisma: PrismaService) {}



  async generateTemplateModele() {

    const buffer = await buildLeasingMensuelleSamplePdf();

    return {

      filename: 'modele-leasing-mensuelle.pdf',

      mime: 'application/pdf',

      buffer,

    };

  }



  async writeTemplateToAssets() {

    const path = await writeLeasingMensuelleHtmlSampleFile();

    return { path };

  }



  async generateLeasingMensuelle(mois: string) {

    if (!/^\d{4}-\d{2}$/.test(mois)) {

      throw new BadRequestException('Mois invalide (attendu YYYY-MM)');

    }



    const data = await this.loadData(mois);

    if (

      data.releves.length === 0 &&

      !data.campagne &&

      !data.facture &&

      data.maintenances.length === 0

    ) {

      throw new BadRequestException(`Aucune donnée pour le rapport leasing mensuel ${mois}`);

    }



    const buffer = await buildLeasingMensuelleHtmlPdf(data);

    return {

      filename: `leasing-mensuelle-${mois}.pdf`,

      mime: 'application/pdf',

      buffer,

    };

  }



  private async loadData(mois: string): Promise<LeasingMensuelleReportData & { clientNom?: string }> {

    const [y, m] = mois.split('-').map(Number);

    const debut = new Date(Date.UTC(y, m - 1, 1));

    const fin = new Date(Date.UTC(y, m, 0));



    const [campagneRow, releves, facture, maintenances, client] = await Promise.all([

      this.prisma.campagneSaisie.findUnique({

        where: { mois },

        include: {

          lignes: {

            include: { imprimante: true },

            orderBy: [

              { imprimante: { localisation: 'asc' } },

              { imprimante: { code: 'asc' } },

            ],

          },

        },

      }),

      this.prisma.releveCompteur.findMany({

        where: { moisFacture: mois },

        include: { imprimante: true },

        orderBy: [{ imprimante: { code: 'asc' } }, { code: 'asc' }],

      }),

      this.prisma.facturePeriode.findUnique({

        where: { mois },

        include: factureInclude,

      }),

      this.prisma.maintenance.findMany({

        where: {

          OR: [{ moisAssistance: mois }, { dateMaintenance: { gte: debut, lte: fin } }],

        },

        include: {

          imprimante: true,

          imprimantes: { include: { imprimante: true } },

          releve: { select: { code: true } },

        },

        orderBy: [{ dateMaintenance: 'asc' }, { code: 'asc' }],

      }),

      this.prisma.client.findFirst({

        where: { actif: true },

        orderBy: { nom: 'asc' },

      }),

    ]);



    const campagne = campagneRow

      ? {

          mois: campagneRow.mois,

          dateReleve: fmtDate(campagneRow.dateReleve),

          portee: campagneRow.portee === 'ALL' ? 'Tous les copieurs' : 'Sélection',

          cloturee: campagneRow.cloturee,

          lignes: campagneRow.lignes.map((l) => {

            const linkedReleve = releves.find((r) => r.id === l.archiveVersReleveId);

            return {

              imprimante: l.imprimante.code,

              localisation: l.imprimante.localisation ?? '',

              c112: l.c112,

              c113: l.c113,

              c122: l.c122,

              c123: l.c123,

              c501: l.c501,

              statut: l.statutLigne,

              liee: !!l.archiveVersReleveId,

              codeReleve: linkedReleve?.code ?? null,

            };

          }),

        }

      : null;



    return {

      mois,

      clientNom: client?.nom,

      campagne,

      releves: releves.map((r) => ({

        code: r.code,

        imprimante: r.imprimante.code,

        localisation: r.imprimante.localisation ?? '',

        statut: r.statut,

        c112: r.c112,

        c113: r.c113,

        c122: r.c122,

        c123: r.c123,

        c501: r.c501,

        deltaN: r.copiesNoirDelta,

        deltaC: r.copiesCouleurDelta,

        factN: r.copiesNoirFacturer,

        factC: r.copiesCouleurFacturer,

        motif: r.observationMotif ?? '',

        totalNoir: r.totalNoir,

        totalCouleur: r.totalCouleur,

        ancienTotalNoir: r.ancienTotalNoir,

        ancienTotalCouleur: r.ancienTotalCouleur,

        quotaNoirDispo: r.quotaNoirDispo,

        quotaCouleurDispo: r.quotaCouleurDispo,

        quotaNoirReport: r.quotaNoirReport,

        quotaCouleurReport: r.quotaCouleurReport,

        attachment: toAttachment(

          r.rapportPath,

          r.rapportNom,

          r.rapportMime,

          `${r.code} — ${r.imprimante.code}`,

        ),

      })),

      facture: facture

        ? {

            code: facture.code,

            statut: facture.statut,

            montantTotal: Number(facture.montantTotal),

            prixNb: Number(facture.prixNb),

            prixCouleur: Number(facture.prixCouleur),

            lignes: facture.lignes.map((l) => ({

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

            })),

          }

        : null,

      maintenances: maintenances.map((mnt) => ({

        code: mnt.code,

        type: mnt.type,

        date: fmtDate(mnt.dateMaintenance),

        horsQuota: mnt.horsQuota,

        imprimante: mnt.imprimante.code,

        localisation: mnt.imprimante.localisation ?? '',

        copieurs: mnt.imprimantes.map((l) => ({

          code: l.imprimante.code,

          localisation: l.imprimante.localisation ?? '',

        })),

        actions: (mnt.actionsRealisees ?? mnt.observations ?? '').slice(0, 120),

        releveCode: mnt.releve?.code ?? null,

        attachment: toAttachment(

          mnt.rapportPath,

          mnt.rapportNom,

          mnt.rapportMime,

          `${mnt.code} — ${mnt.imprimante.code}`,

        ),

      })),

    };

  }

}



function fmtDate(d: Date) {

  return d.toISOString().slice(0, 10);

}



function toAttachment(

  path: string | null | undefined,

  nom: string | null | undefined,

  mime: string | null | undefined,

  label: string,

): ReportAttachment | null {

  if (!path) return null;

  return {

    label,

    subtitle: nom ?? undefined,

    relativePath: path,

    mime: mime ?? null,

    originalName: nom ?? null,

  };

}


