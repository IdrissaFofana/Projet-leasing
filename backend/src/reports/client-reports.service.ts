import { BadRequestException, Injectable } from '@nestjs/common';
import { StatutImprimante } from '@prisma/client';
import {
  buildLeasingPeriodeHtmlPdf,
  resolveLeasingPeriode,
} from '../common/export/leasing-annuelle-html.builder';
import type { LeasingPeriodeSpec } from '../common/export/leasing-annuelle-view.mapper';
import { buildInterventionHtmlPdf } from '../common/export/intervention-html.builder';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLeasingAnnuelle(annee: string) {
    return this.generateLeasingPeriode({ kind: 'annuelle', annee });
  }

  async generateLeasingSemestrielle(annee: string, semestre: string) {
    const s = Number(semestre);
    if (s !== 1 && s !== 2) {
      throw new BadRequestException('Semestre invalide (1 ou 2)');
    }
    return this.generateLeasingPeriode({ kind: 'semestrielle', annee, index: s });
  }

  async generateLeasingTrimestrielle(annee: string, trimestre: string) {
    const t = Number(trimestre);
    if (![1, 2, 3, 4].includes(t)) {
      throw new BadRequestException('Trimestre invalide (1 à 4)');
    }
    return this.generateLeasingPeriode({ kind: 'trimestrielle', annee, index: t });
  }

  private async generateLeasingPeriode(spec: LeasingPeriodeSpec) {
    if (!/^\d{4}$/.test(spec.annee)) {
      throw new BadRequestException('Année invalide (attendu YYYY)');
    }

    let periode;
    try {
      periode = resolveLeasingPeriode(spec);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Période invalide');
    }

    const moisSet = new Set(periode.moisKeys);
    const debut = new Date(periode.periodeDebutIso);
    const finExclusive = new Date(periode.periodeFinIso);
    finExclusive.setUTCDate(finExclusive.getUTCDate() + 1);

    const [releves, maintenances, imprimantesActives, client] = await Promise.all([
      this.prisma.releveCompteur.findMany({
        where: { moisFacture: { in: periode.moisKeys } },
        include: { imprimante: true },
        orderBy: [{ moisFacture: 'asc' }, { imprimante: { code: 'asc' } }],
      }),
      this.prisma.maintenance.findMany({
        where: {
          OR: [
            { moisAssistance: { in: periode.moisKeys } },
            {
              moisAssistance: null,
              dateMaintenance: {
                gte: debut,
                lt: finExclusive,
              },
            },
          ],
        },
        select: {
          type: true,
          taches: true,
          moisAssistance: true,
          horsQuota: true,
          releveId: true,
        },
      }),
      this.prisma.imprimante.count({
        where: { statut: { not: StatutImprimante.RETIREE } },
      }),
      this.prisma.client.findFirst({ orderBy: { createdAt: 'asc' } }),
    ]);

    const maintenancesInPeriod = maintenances.filter((m) => {
      if (m.moisAssistance) return moisSet.has(m.moisAssistance);
      return true;
    });

    if (releves.length === 0 && maintenancesInPeriod.length === 0) {
      throw new BadRequestException(
        `Aucune donnée pour le rapport leasing ${periode.labelCourt}`,
      );
    }

    const { buffer, filename } = await buildLeasingPeriodeHtmlPdf({
      spec,
      clientNom: client?.nom ?? 'Client',
      imprimantesActives,
      releves: releves.map((r) => ({
        moisFacture: r.moisFacture,
        copiesNoirDelta: r.copiesNoirDelta,
        copiesCouleurDelta: r.copiesCouleurDelta,
        copiesNoirFacturer: r.copiesNoirFacturer,
        copiesCouleurFacturer: r.copiesCouleurFacturer,
        quotaNoirReport: r.quotaNoirReport,
        quotaCouleurReport: r.quotaCouleurReport,
        quotaNoirDispo: r.quotaNoirDispo,
        quotaCouleurDispo: r.quotaCouleurDispo,
        imprimante: {
          code: r.imprimante.code,
          localisation: r.imprimante.localisation,
        },
      })),
      maintenances: maintenancesInPeriod.map((m) => ({
        type: m.type,
        taches: m.taches as string[],
        moisAssistance: m.moisAssistance,
        horsQuota: m.horsQuota,
        releveId: m.releveId,
      })),
    });

    return {
      filename,
      mime: 'application/pdf',
      buffer,
    };
  }

  async generateIntervention(id: string) {
    const row = await this.prisma.maintenance.findUnique({
      where: { id },
      include: {
        imprimante: true,
        imprimantes: { include: { imprimante: true } },
        technicien: true,
        assigneeUser: { select: { nom: true, email: true } },
        releve: { select: { code: true } },
      },
    });
    if (!row) throw new BadRequestException('Intervention introuvable');

    const client = await this.prisma.client.findFirst({ orderBy: { createdAt: 'asc' } });
    const copieurs =
      row.imprimantes.length > 0
        ? row.imprimantes.map((l) => ({
            code: l.imprimante.code,
            localisation: l.imprimante.localisation,
            modele: l.imprimante.modele,
          }))
        : [
            {
              code: row.imprimante.code,
              localisation: row.imprimante.localisation,
              modele: row.imprimante.modele,
            },
          ];

    const heure = row.heureMaintenance
      ? `${String(row.heureMaintenance.getHours()).padStart(2, '0')}:${String(row.heureMaintenance.getMinutes()).padStart(2, '0')}`
      : null;

    const buffer = await buildInterventionHtmlPdf({
      code: row.code,
      dateMaintenance: row.dateMaintenance,
      heure,
      type: row.type,
      taches: (row.taches?.length ? row.taches : [row.type]) as string[],
      horsQuota: row.horsQuota,
      releveId: row.releveId,
      moisAssistance: row.moisAssistance,
      actionsRealisees: row.actionsRealisees,
      piecesConsommables: row.piecesConsommables,
      observations: row.observations,
      prochaineMaintenance: row.prochaineMaintenance,
      clientNom: client?.nom ?? 'Client',
      technicien: row.technicien?.nom ?? null,
      assignee: row.assigneeUser
        ? `${row.assigneeUser.nom} (${row.assigneeUser.email})`
        : null,
      copieurs,
      rapportPath: row.rapportPath,
      rapportMime: row.rapportMime,
      releveCode: row.releve?.code ?? null,
    });

    return {
      filename: `intervention-${row.code}.pdf`,
      mime: 'application/pdf',
      buffer,
    };
  }
}
