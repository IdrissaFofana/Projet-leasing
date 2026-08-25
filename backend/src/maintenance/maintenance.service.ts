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
    if (query.imprimanteId) where.imprimanteId = query.imprimanteId;
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

  /** Quota assistances : 3 / imprimante / mois */
  async assistanceQuota(mois?: string) {
    const target =
      mois && /^\d{4}-\d{2}$/.test(mois) ? mois : moisFromDate(new Date());
    const printers = await this.prisma.imprimante.findMany({
      where: { statut: { not: StatutImprimante.RETIREE } },
      orderBy: [{ localisation: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, localisation: true },
    });
    const counts = await this.prisma.maintenance.groupBy({
      by: ['imprimanteId'],
      where: {
        type: TypeMaintenance.ASSISTANCE,
        moisAssistance: target,
      },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.imprimanteId, c._count._all]));
    const lignes = printers.map((p) => {
      const faites = map.get(p.id) ?? 0;
      return {
        imprimanteId: p.id,
        code: p.code,
        localisation: p.localisation,
        faites,
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
    const printer = await this.prisma.imprimante.findUnique({
      where: { id: dto.imprimanteId },
    });
    if (!printer) throw new NotFoundException('Imprimante introuvable');

    if (dto.assigneeUserId) {
      const u = await this.prisma.utilisateur.findUnique({
        where: { id: dto.assigneeUserId },
      });
      if (!u || !u.actif) throw new NotFoundException('Utilisateur assigné introuvable');
    }

    const moisAssistance = moisFromDate(dto.dateMaintenance);

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode(EntiteSequence.MAINTENANCE, tx);
      const row = await tx.maintenance.create({
        data: {
          code,
          dateMaintenance: new Date(dto.dateMaintenance),
          heureMaintenance: this.parseHeure(dto.heureMaintenance),
          imprimanteId: dto.imprimanteId,
          type: dto.type,
          technicienId: dto.technicienId,
          assigneeUserId: dto.assigneeUserId,
          actionsRealisees: dto.actionsRealisees,
          piecesConsommables: dto.piecesConsommables,
          prochaineMaintenance: dto.prochaineMaintenance
            ? new Date(dto.prochaineMaintenance)
            : null,
          observations: dto.observations,
          moisAssistance,
        },
        include,
      });

      if (dto.prochaineMaintenance) {
        await tx.imprimante.update({
          where: { id: dto.imprimanteId },
          data: { prochaineMaintenance: new Date(dto.prochaineMaintenance) },
        });
      }

      return row;
    });

    if (created.assigneeUserId) {
      await this.notifications.notifyUser({
        userId: created.assigneeUserId,
        type: NotificationType.MAINTENANCE_PROCHE,
        titre: `Assistance assignée — ${printer.code}`,
        message: `${created.code} vous a été attribuée (${printer.localisation ?? printer.modele})`,
        lien: `/maintenance/${created.id}`,
        fingerprint: `assist:assigned:${created.id}`,
      });
    }

    return created;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(id);
    if (dto.assigneeUserId) {
      const u = await this.prisma.utilisateur.findUnique({
        where: { id: dto.assigneeUserId },
      });
      if (!u || !u.actif) throw new NotFoundException('Utilisateur assigné introuvable');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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
          type: dto.type,
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
          moisAssistance: dto.dateMaintenance
            ? moisFromDate(dto.dateMaintenance)
            : undefined,
        },
        include,
      });

      if (dto.prochaineMaintenance) {
        await tx.imprimante.update({
          where: { id: row.imprimanteId },
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
