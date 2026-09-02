import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EntiteSequence, NotificationType, Prisma, StatutImprimante, TypeMaintenance } from '@prisma/client';
import * as fs from 'fs';
import {
  ASSISTANCES_PAR_MOIS,
  countAssistancesParImprimante,
  countPrelevementsParImprimante,
  whereAssistanceDansQuota,
} from '../common/domain/assistance-quota';
import {
  absoluteUploadPath,
  moisFromDate,
  saveReportFile,
} from '../common/upload/report-files';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../sequences/sequences.service';
import {
  CreateMaintenanceDto,
  MaintenanceQueryDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';

const include = {
  imprimante: { include: { marque: true } },
  imprimantes: {
    include: { imprimante: { include: { marque: true } } },
  },
  technicien: true,
  assigneeUser: { select: { id: true, nom: true, email: true } },
  releve: { select: { id: true, code: true, moisFacture: true } },
} satisfies Prisma.MaintenanceInclude;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(query: MaintenanceQueryDto) {
    const where: Prisma.MaintenanceWhereInput = {};
    if (query.imprimanteId) {
      where.OR = [
        { imprimanteId: query.imprimanteId },
        { imprimantes: { some: { imprimanteId: query.imprimanteId } } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.moisAssistance) where.moisAssistance = query.moisAssistance;
    if (query.assigneeUserId) where.assigneeUserId = query.assigneeUserId;
    return this.prisma.maintenance.findMany({
      where,
      include,
      orderBy: [{ dateMaintenance: 'desc' }, { code: 'desc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.maintenance.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException('Maintenance introuvable');
    return row;
  }

  /** Quota assistances : 1 incluse / imprimante / mois (hors panne et prélèvements compteur). */
  async assistanceQuota(mois?: string) {
    const target =
      mois && /^\d{4}-\d{2}$/.test(mois) ? mois : moisFromDate(new Date());
    const printers = await this.prisma.imprimante.findMany({
      where: { statut: { not: StatutImprimante.RETIREE } },
      orderBy: [{ localisation: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, localisation: true },
    });
    const [inQuota, panne, prelevements] = await Promise.all([
      countAssistancesParImprimante(this.prisma, target, { horsQuota: false }),
      countAssistancesParImprimante(this.prisma, target, { horsQuota: true }),
      countPrelevementsParImprimante(this.prisma, target),
    ]);
    const lignes = printers.map((p) => {
      const faites = inQuota.get(p.id) ?? 0;
      const panneCount = panne.get(p.id) ?? 0;
      const prelevementCount = prelevements.get(p.id) ?? 0;
      return {
        imprimanteId: p.id,
        code: p.code,
        localisation: p.localisation,
        faites,
        panne: panneCount,
        prelevements: prelevementCount,
        total: faites + panneCount + prelevementCount,
        prevues: ASSISTANCES_PAR_MOIS,
        restantes: Math.max(0, ASSISTANCES_PAR_MOIS - faites),
        complet: faites >= ASSISTANCES_PAR_MOIS,
      };
    });
    return {
      mois: target,
      prevuesParImprimante: ASSISTANCES_PAR_MOIS,
      incomplete: lignes.filter((l) => !l.complet).length,
      lignes,
    };
  }

  async create(dto: CreateMaintenanceDto) {
    const imprimanteIds = this.resolveImprimanteIds(dto);
    await this.ensurePrintersExist(imprimanteIds);

    if (dto.assigneeUserId) {
      const u = await this.prisma.utilisateur.findUnique({
        where: { id: dto.assigneeUserId },
      });
      if (!u || !u.actif) throw new NotFoundException('Utilisateur assigné introuvable');
    }

    const taches = this.resolveTaches(dto.taches, dto.type);
    const type = this.resolvePrimaryType(taches, dto.type);
    const moisAssistance = moisFromDate(dto.dateMaintenance);
    const horsQuota = dto.horsQuota ?? false;
    const isAssistance = taches.includes(TypeMaintenance.ASSISTANCE);

    const created = await this.prisma.$transaction(async (tx) => {
      if (isAssistance && !horsQuota) {
        await this.assertQuotaAvailable(tx, imprimanteIds, moisAssistance);
      }

      const code = await this.sequences.nextCode(EntiteSequence.MAINTENANCE, tx);
      const row = await tx.maintenance.create({
        data: {
          code,
          dateMaintenance: new Date(dto.dateMaintenance),
          heureMaintenance: this.parseHeure(dto.heureMaintenance),
          imprimanteId: imprimanteIds[0],
          type,
          taches,
          technicienId: dto.technicienId,
          assigneeUserId: dto.assigneeUserId,
          actionsRealisees: dto.actionsRealisees,
          piecesConsommables: dto.piecesConsommables,
          prochaineMaintenance: dto.prochaineMaintenance
            ? new Date(dto.prochaineMaintenance)
            : null,
          observations: dto.observations,
          moisAssistance,
          horsQuota,
          imprimantes: {
            create: imprimanteIds.map((imprimanteId) => ({ imprimanteId })),
          },
        },
        include,
      });

      if (dto.prochaineMaintenance) {
        await tx.imprimante.updateMany({
          where: { id: { in: imprimanteIds } },
          data: { prochaineMaintenance: new Date(dto.prochaineMaintenance) },
        });
      }

      return row;
    });

    const printerLabel = created.imprimantes
      .map((l) => l.imprimante.code)
      .join(', ');
    if (created.assigneeUserId) {
      await this.notifications.notifyUser({
        userId: created.assigneeUserId,
        type: NotificationType.MAINTENANCE_PROCHE,
        titre: `Assistance assignée — ${printerLabel}`,
        message: `${created.code} vous a été attribuée`,
        lien: `/maintenance/${created.id}`,
        fingerprint: `assist:assigned:${created.id}`,
      });
    }

    return created;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    const existing = await this.findOne(id);
    if (dto.assigneeUserId) {
      const u = await this.prisma.utilisateur.findUnique({
        where: { id: dto.assigneeUserId },
      });
      if (!u || !u.actif) throw new NotFoundException('Utilisateur assigné introuvable');
    }

    const imprimanteIds = dto.imprimanteIds
      ? [...new Set(dto.imprimanteIds)]
      : existing.imprimantes.map((l) => l.imprimanteId);
    if (dto.imprimanteIds) await this.ensurePrintersExist(imprimanteIds);

    const moisAssistance = dto.dateMaintenance
      ? moisFromDate(dto.dateMaintenance)
      : existing.moisAssistance ?? moisFromDate(existing.dateMaintenance);
    const taches = dto.taches
      ? this.resolveTaches(dto.taches, dto.type)
      : existing.taches?.length
        ? existing.taches
        : [existing.type];
    const type = dto.taches || dto.type ? this.resolvePrimaryType(taches, dto.type) : existing.type;
    const horsQuota = dto.horsQuota ?? existing.horsQuota;
    const isAssistance = taches.includes(TypeMaintenance.ASSISTANCE);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isAssistance && !horsQuota) {
        await this.assertQuotaAvailable(tx, imprimanteIds, moisAssistance, id);
      }

      if (dto.imprimanteIds) {
        await tx.maintenanceImprimante.deleteMany({ where: { maintenanceId: id } });
        await tx.maintenanceImprimante.createMany({
          data: imprimanteIds.map((imprimanteId) => ({ maintenanceId: id, imprimanteId })),
        });
      }

      const row = await tx.maintenance.update({
        where: { id },
        data: {
          dateMaintenance: dto.dateMaintenance
            ? new Date(dto.dateMaintenance)
            : undefined,
          heureMaintenance:
            dto.heureMaintenance === undefined
              ? undefined
              : this.parseHeure(dto.heureMaintenance),
          imprimanteId: dto.imprimanteIds ? imprimanteIds[0] : undefined,
          type,
          taches: dto.taches ? taches : undefined,
          horsQuota: dto.horsQuota,
          technicienId: dto.technicienId === undefined ? undefined : dto.technicienId,
          assigneeUserId:
            dto.assigneeUserId === undefined ? undefined : dto.assigneeUserId,
          actionsRealisees:
            dto.actionsRealisees === undefined ? undefined : dto.actionsRealisees,
          piecesConsommables:
            dto.piecesConsommables === undefined
              ? undefined
              : dto.piecesConsommables,
          prochaineMaintenance:
            dto.prochaineMaintenance === undefined
              ? undefined
              : dto.prochaineMaintenance
                ? new Date(dto.prochaineMaintenance)
                : null,
          observations:
            dto.observations === undefined ? undefined : dto.observations,
          moisAssistance: dto.dateMaintenance ? moisAssistance : undefined,
        },
        include,
      });

      if (dto.prochaineMaintenance) {
        await tx.imprimante.updateMany({
          where: { id: { in: imprimanteIds } },
          data: { prochaineMaintenance: new Date(dto.prochaineMaintenance) },
        });
      }

      return row;
    });

    if (dto.assigneeUserId) {
      await this.notifications.notifyUser({
        userId: dto.assigneeUserId,
        type: NotificationType.MAINTENANCE_PROCHE,
        titre: `Assistance assignée — ${updated.imprimante.code}`,
        message: `${updated.code} vous a été attribuée`,
        lien: `/maintenance/${updated.id}`,
        fingerprint: `assist:assigned:${updated.id}`,
      });
    }

    return updated;
  }

  async uploadRapport(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);
    if (existing.rapportPath) {
      const prev = absoluteUploadPath(existing.rapportPath);
      if (fs.existsSync(prev)) fs.unlinkSync(prev);
    }
    const saved = saveReportFile('maintenance', file);
    return this.prisma.maintenance.update({
      where: { id },
      data: {
        rapportPath: saved.relativePath,
        rapportNom: saved.originalName,
        rapportMime: saved.mime,
      },
      include,
    });
  }

  async downloadRapport(id: string) {
    const row = await this.findOne(id);
    if (!row.rapportPath) throw new NotFoundException('Aucun rapport attaché');
    const abs = absoluteUploadPath(row.rapportPath);
    if (!fs.existsSync(abs)) throw new NotFoundException('Fichier rapport introuvable');
    const buf = fs.readFileSync(abs);
    return new StreamableFile(buf, {
      type: row.rapportMime ?? 'application/octet-stream',
      disposition: `inline; filename="${row.rapportNom ?? 'rapport'}"`,
    });
  }

  async remove(id: string) {
    const row = await this.findOne(id);
    if (row.rapportPath) {
      const abs = absoluteUploadPath(row.rapportPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    return this.prisma.maintenance.delete({ where: { id }, include });
  }

  private resolveTaches(
    taches?: TypeMaintenance[],
    type?: TypeMaintenance,
  ): TypeMaintenance[] {
    const list = [...new Set((taches?.length ? taches : type ? [type] : []) as TypeMaintenance[])];
    if (list.length === 0) {
      throw new BadRequestException('Au moins une tâche est requise');
    }
    return list;
  }

  private resolvePrimaryType(
    taches: TypeMaintenance[],
    preferred?: TypeMaintenance,
  ): TypeMaintenance {
    if (preferred && taches.includes(preferred)) return preferred;
    if (taches.includes(TypeMaintenance.ASSISTANCE)) return TypeMaintenance.ASSISTANCE;
    return taches[0];
  }

  private resolveImprimanteIds(dto: CreateMaintenanceDto): string[] {
    const ids =
      dto.imprimanteIds?.length > 0
        ? dto.imprimanteIds
        : dto.imprimanteId
          ? [dto.imprimanteId]
          : [];
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('Au moins un copieur est requis');
    }
    return unique;
  }

  private async ensurePrintersExist(ids: string[]) {
    const found = await this.prisma.imprimante.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true },
    });
    if (found.length !== ids.length) {
      throw new NotFoundException('Un ou plusieurs copieurs introuvables');
    }
    return found;
  }

  private async assertQuotaAvailable(
    tx: Prisma.TransactionClient,
    imprimanteIds: string[],
    mois: string,
    excludeMaintenanceId?: string,
  ) {
    const counts = await countAssistancesParImprimante(tx, mois, { horsQuota: false });
    const printers = await tx.imprimante.findMany({
      where: { id: { in: imprimanteIds } },
      select: { id: true, code: true },
    });
    for (const p of printers) {
      let faites = counts.get(p.id) ?? 0;
      if (excludeMaintenanceId) {
        const linked = await tx.maintenanceImprimante.findFirst({
          where: {
            maintenanceId: excludeMaintenanceId,
            imprimanteId: p.id,
            maintenance: whereAssistanceDansQuota(mois),
          },
        });
        if (linked) faites = Math.max(0, faites - 1);
      }
      if (faites >= ASSISTANCES_PAR_MOIS) {
        throw new BadRequestException(
          `Quota assistance atteint pour ${p.code} en ${mois}. Cochez « Panne signalée » pour une intervention hors quota.`,
        );
      }
    }
  }

  private parseHeure(value?: string | null): Date | null {
    if (!value) return null;
    if (/^\d{1,2}:\d{2}/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('heureMaintenance invalide');
    }
    return parsed;
  }
}
