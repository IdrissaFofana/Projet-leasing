import { Injectable } from '@nestjs/common';
import {
  StatutImprimante,
  StatutReleve,
  StatutStock,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const mois = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const [
      imprimantesActives,
      imprimantesRetirees,
      stockBas,
      stockEpuise,
      anomaliesReleves,
      maintenancesProches,
      factureMois,
      entreesRecentes,
      affectationsRecentes,
    ] = await Promise.all([
      this.prisma.imprimante.count({
        where: { statut: { not: StatutImprimante.RETIREE } },
      }),
      this.prisma.imprimante.count({
        where: { statut: StatutImprimante.RETIREE },
      }),
      this.prisma.cartoucheSku.count({
        where: {
          OR: [
            { qteRestante: { lte: 2, gt: 0 } },
            { statut: StatutStock.PARTIELLEMENT_UTILISEE, qteRestante: { lte: 2 } },
          ],
        },
      }),
      this.prisma.cartoucheSku.count({
        where: {
          statut: { in: [StatutStock.EPUISE, StatutStock.AUCUN_STOCK, StatutStock.SUR_AFFECTE] },
        },
      }),
      this.prisma.releveCompteur.count({
        where: { statut: StatutReleve.ANOMALIE_COMPTEUR },
      }),
      this.prisma.imprimante.count({
        where: {
          prochaineMaintenance: { not: null, lte: in7 },
          statut: { not: StatutImprimante.RETIREE },
        },
      }),
      this.prisma.facturePeriode.findUnique({ where: { mois } }),
      this.prisma.entreeStock.count({
        where: {
          dateEntree: { gte: new Date(new Date().setDate(now.getDate() - 30)) },
        },
      }),
      this.prisma.affectation.count({
        where: {
          datePose: { gte: new Date(new Date().setDate(now.getDate() - 30)) },
        },
      }),
    ]);

    const alertes = {
      stockBas,
      stockEpuise,
      anomaliesReleves,
      maintenancesProches,
    };

    return {
      moisCourant: mois,
      parc: { actives: imprimantesActives, retirees: imprimantesRetirees },
      stock: { alertesBas: stockBas, epuises: stockEpuise },
      releves: { anomalies: anomaliesReleves },
      maintenance: { aVenir7j: maintenancesProches },
      activite30j: { entrees: entreesRecentes, affectations: affectationsRecentes },
      facturation: factureMois
        ? {
            code: factureMois.code,
            statut: factureMois.statut,
            montantTotal: factureMois.montantTotal,
          }
        : null,
      alertes,
      scoreAlertes:
        stockBas + stockEpuise + anomaliesReleves + maintenancesProches,
    };
  }
}
