import { Injectable } from '@nestjs/common';
import {
  NotificationPriority,
  NotificationType,
  StatutFacturePeriode,
  StatutImprimante,
  StatutReleve,
  StatutStock,
  TypeMaintenance,
} from '@prisma/client';
import {
  hasPermission,
  type ModulePermission,
} from '../common/auth/permissions';
import { ASSISTANCES_PAR_MOIS, countAssistancesParImprimante } from '../common/domain/assistance-quota';
import { PrismaService } from '../prisma/prisma.service';

type AlertCandidate = {
  type: NotificationType;
  priority: NotificationPriority;
  titre: string;
  message: string;
  lien: string;
  fingerprint: string;
  /** Module requis pour recevoir l’alerte */
  module: ModulePermission;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, limit = 40) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ luAt: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 100),
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, luAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) return null;
    if (n.luAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { luAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, luAt: null },
      data: { luAt: new Date() },
    });
    return { ok: true };
  }

  /** Sync alertes métier selon les permissions modules de l’utilisateur. */
  async syncForUser(
    userId: string,
    role: string,
    permissions?: string[] | null,
  ) {
    const candidates = await this.buildAlertCandidates();
    const relevant = candidates.filter((c) =>
      hasPermission(role, permissions, c.module),
    );

    for (const c of relevant) {
      await this.prisma.notification.upsert({
        where: {
          userId_fingerprint: { userId, fingerprint: c.fingerprint },
        },
        create: {
          userId,
          type: c.type,
          priority: c.priority,
          titre: c.titre,
          message: c.message,
          lien: c.lien,
          fingerprint: c.fingerprint,
        },
        update: {
          titre: c.titre,
          message: c.message,
          priority: c.priority,
          lien: c.lien,
        },
      });
    }

    // Assistances personnellement assignées
    const assigned = await this.prisma.maintenance.findMany({
      where: {
        assigneeUserId: userId,
        type: TypeMaintenance.ASSISTANCE,
        dateMaintenance: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      include: { imprimante: true },
      take: 20,
      orderBy: { dateMaintenance: 'desc' },
    });
    for (const a of assigned) {
      const fingerprint = `assist:assigned:${a.id}`;
      await this.prisma.notification.upsert({
        where: { userId_fingerprint: { userId, fingerprint } },
        create: {
          userId,
          type: NotificationType.MAINTENANCE_PROCHE,
          priority: NotificationPriority.HIGH,
          titre: `Assistance assignée — ${a.imprimante.code}`,
          message: `${a.code} · ${a.imprimante.localisation ?? a.imprimante.modele}`,
          lien: `/maintenance/${a.id}`,
          fingerprint,
        },
        update: {
          titre: `Assistance assignée — ${a.imprimante.code}`,
          message: `${a.code} · ${a.imprimante.localisation ?? a.imprimante.modele}`,
          lien: `/maintenance/${a.id}`,
        },
      });
      relevant.push({
        type: NotificationType.MAINTENANCE_PROCHE,
        priority: NotificationPriority.HIGH,
        titre: '',
        message: '',
        lien: '',
        fingerprint,
        module: 'maintenance',
      });
    }

    const keep = new Set(relevant.map((c) => c.fingerprint));
    const stale = await this.prisma.notification.findMany({
      where: {
        userId,
        type: {
          in: [
            NotificationType.STOCK_BAS,
            NotificationType.STOCK_EPUISE,
            NotificationType.ANOMALIE_RELEVE,
            NotificationType.MAINTENANCE_PROCHE,
            NotificationType.ASSISTANCE_QUOTA,
            NotificationType.FACTURATION,
            NotificationType.CAMPAGNE,
          ],
        },
        fingerprint: { startsWith: 'alert:' },
      },
      select: { id: true, fingerprint: true },
    });
    // Also clean assigned fingerprints that no longer apply
    const staleAssigned = await this.prisma.notification.findMany({
      where: {
        userId,
        fingerprint: { startsWith: 'assist:assigned:' },
      },
      select: { id: true, fingerprint: true },
    });
    const toDelete = [...stale, ...staleAssigned]
      .filter((s) => !keep.has(s.fingerprint))
      .map((s) => s.id);
    if (toDelete.length) {
      await this.prisma.notification.deleteMany({ where: { id: { in: toDelete } } });
    }

    return this.listMine(userId);
  }

  async notifyUser(params: {
    userId: string;
    type: NotificationType;
    priority?: NotificationPriority;
    titre: string;
    message: string;
    lien?: string;
    fingerprint: string;
  }) {
    return this.prisma.notification.upsert({
      where: {
        userId_fingerprint: {
          userId: params.userId,
          fingerprint: params.fingerprint,
        },
      },
      create: {
        userId: params.userId,
        type: params.type,
        priority: params.priority ?? NotificationPriority.NORMAL,
        titre: params.titre,
        message: params.message,
        lien: params.lien,
        fingerprint: params.fingerprint,
      },
      update: {
        titre: params.titre,
        message: params.message,
        lien: params.lien,
        priority: params.priority ?? NotificationPriority.NORMAL,
        luAt: null,
      },
    });
  }

  async createMessageNotification(params: {
    destinataireId: string;
    expediteurNom: string;
    sujet: string;
    messageId: string;
  }) {
    return this.notifyUser({
      userId: params.destinataireId,
      type: NotificationType.MESSAGE,
      titre: `Message de ${params.expediteurNom}`,
      message: params.sujet,
      lien: '/messagerie',
      fingerprint: `message:${params.messageId}`,
    });
  }

  private async buildAlertCandidates(): Promise<AlertCandidate[]> {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const dayKey = now.toISOString().slice(0, 10);
    const mois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [stockBas, stockEpuise, anomalies, maintenances, facture, campagne] =
      await Promise.all([
        this.prisma.cartoucheSku.count({
          where: {
            OR: [
              { qteRestante: { lte: 2, gt: 0 } },
              {
                statut: StatutStock.PARTIELLEMENT_UTILISEE,
                qteRestante: { lte: 2 },
              },
            ],
          },
        }),
        this.prisma.cartoucheSku.count({
          where: {
            statut: {
              in: [StatutStock.EPUISE, StatutStock.AUCUN_STOCK, StatutStock.SUR_AFFECTE],
            },
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
        this.prisma.campagneSaisie.findUnique({ where: { mois } }),
      ]);

    const out: AlertCandidate[] = [];

    if (stockBas > 0) {
      out.push({
        type: NotificationType.STOCK_BAS,
        priority: NotificationPriority.HIGH,
        titre: 'Stock bas',
        message: `${stockBas} référence(s) de cartouche en seuil bas.`,
        lien: '/stock',
        fingerprint: `alert:STOCK_BAS:${dayKey}:${stockBas}`,
        module: 'stock',
      });
    }
    if (stockEpuise > 0) {
      out.push({
        type: NotificationType.STOCK_EPUISE,
        priority: NotificationPriority.CRITICAL,
        titre: 'Stock épuisé',
        message: `${stockEpuise} référence(s) épuisée(s) ou sans stock.`,
        lien: '/stock',
        fingerprint: `alert:STOCK_EPUISE:${dayKey}:${stockEpuise}`,
        module: 'stock',
      });
    }
    if (anomalies > 0) {
      out.push({
        type: NotificationType.ANOMALIE_RELEVE,
        priority: NotificationPriority.HIGH,
        titre: 'Anomalies de relevés',
        message: `${anomalies} relevé(s) en anomalie compteur à contrôler.`,
        lien: '/releves',
        fingerprint: `alert:ANOMALIE:${dayKey}:${anomalies}`,
        module: 'readings',
      });
    }
    if (maintenances > 0) {
      out.push({
        type: NotificationType.MAINTENANCE_PROCHE,
        priority: NotificationPriority.NORMAL,
        titre: 'Maintenances à venir',
        message: `${maintenances} imprimante(s) à maintenir sous 7 jours.`,
        lien: '/maintenance',
        fingerprint: `alert:MAINT:${dayKey}:${maintenances}`,
        module: 'maintenance',
      });
    }

    const dayOfMonth = now.getDate();
    if (dayOfMonth >= 10) {
      const printers = await this.prisma.imprimante.findMany({
        where: { statut: { not: StatutImprimante.RETIREE } },
        select: { id: true, code: true },
      });
      const counts = await countAssistancesParImprimante(this.prisma, mois, {
        horsQuota: false,
      });
      const incomplete = printers.filter(
        (p) => (counts.get(p.id) ?? 0) < ASSISTANCES_PAR_MOIS,
      );
      if (incomplete.length > 0) {
        const samples = incomplete
          .slice(0, 5)
          .map((p) => `${p.code} (${counts.get(p.id) ?? 0}/${ASSISTANCES_PAR_MOIS})`)
          .join(', ');
        out.push({
          type: NotificationType.ASSISTANCE_QUOTA,
          priority:
            dayOfMonth >= 20
              ? NotificationPriority.HIGH
              : NotificationPriority.NORMAL,
          titre: `Assistances ${mois}`,
          message: `${incomplete.length} copieur(s) sans assistance incluse ce mois. Ex. : ${samples}. Prélèvements compteur et pannes signalées hors quota.`,
          lien: '/maintenance/quotas',
          fingerprint: `alert:ASSIST:${mois}:${incomplete.length}`,
          module: 'maintenance',
        });
      }
    }

    if (facture && facture.statut !== StatutFacturePeriode.CLOTUREE) {
      out.push({
        type: NotificationType.FACTURATION,
        priority: NotificationPriority.NORMAL,
        titre: `Facturation ${mois}`,
        message: `Période ${facture.code} — statut ${facture.statut}.`,
        lien: '/facturation',
        fingerprint: `alert:FACTU:${mois}:${facture.statut}`,
        module: 'billing',
      });
    }
    if (campagne && !campagne.cloturee) {
      out.push({
        type: NotificationType.CAMPAGNE,
        priority: NotificationPriority.LOW,
        titre: `Campagne ${mois}`,
        message: 'Campagne de saisie ouverte — compléter les lignes manquantes.',
        lien: '/campagnes',
        fingerprint: `alert:CAMP:${mois}:open`,
        module: 'campaigns',
      });
    }

    return out;
  }
}
