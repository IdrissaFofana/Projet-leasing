import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouleurToner,
  EntiteSequence,
  Prisma,
  StatutPose,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../sequences/sequences.service';
import { StockService } from '../stock/stock.service';
import {
  AssignmentQueryDto,
  CreateAffectationDto,
  CreateKitDto,
} from './dto/assignment.dto';

const KIT_COULEURS: CouleurToner[] = [
  CouleurToner.TONER_BLACK,
  CouleurToner.TONER_CYAN,
  CouleurToner.TONER_MAGENTA,
  CouleurToner.TONER_YELLOW,
];

const affectationInclude = {
  imprimante: { include: { marque: true } },
  modele: { include: { marque: true } },
  agent: true,
  lignes: { include: { sku: true }, orderBy: { couleur: 'asc' as const } },
} satisfies Prisma.AffectationInclude;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
    private readonly stock: StockService,
  ) {}

  findAll(query: AssignmentQueryDto) {
    const where: Prisma.AffectationWhereInput = {};
    if (query.imprimanteId) where.imprimanteId = query.imprimanteId;
    if (query.modeleId) where.modeleId = query.modeleId;
    if (query.from || query.to) {
      where.datePose = {};
      if (query.from) where.datePose.gte = new Date(query.from);
      if (query.to) where.datePose.lte = new Date(query.to);
    }

    return this.prisma.affectation.findMany({
      where,
      include: affectationInclude,
      orderBy: [{ datePose: 'desc' }, { code: 'desc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.affectation.findUnique({
      where: { id },
      include: affectationInclude,
    });
    if (!row) throw new NotFoundException('Affectation introuvable');
    return row;
  }

  createKit(dto: CreateKitDto) {
    const qte = dto.qteParCouleur ?? 1;
    return this.create({
      datePose: dto.datePose,
      heurePose: dto.heurePose,
      imprimanteId: dto.imprimanteId,
      modeleId: dto.modeleId,
      agentId: dto.agentId,
      motif: dto.motif,
      statutPose: dto.statutPose,
      observations: dto.observations,
      lignes: KIT_COULEURS.map((couleur) => ({ couleur, qte })),
    });
  }

  async create(dto: CreateAffectationDto) {
    await this.ensurePrinter(dto.imprimanteId);
    await this.ensureModele(dto.modeleId);

    const lignes = this.normalizeLignes(dto.lignes);

    return this.prisma.$transaction(async (tx) => {
      for (const ligne of lignes) {
        const sku = await tx.cartoucheSku.upsert({
          where: {
            modeleId_couleur: {
              modeleId: dto.modeleId,
              couleur: ligne.couleur,
            },
          },
          update: {},
          create: { modeleId: dto.modeleId, couleur: ligne.couleur },
        });
        if (sku.qteRestante < ligne.qte) {
          throw new BadRequestException(
            `Stock insuffisant pour ${ligne.couleur} (dispo ${sku.qteRestante}, demandé ${ligne.qte})`,
          );
        }
      }

      const code = await this.sequences.nextCode(EntiteSequence.AFFECTATION, tx);
      const created = await tx.affectation.create({
        data: {
          code,
          datePose: new Date(dto.datePose),
          heurePose: this.parseHeure(dto.heurePose),
          imprimanteId: dto.imprimanteId,
          modeleId: dto.modeleId,
          agentId: dto.agentId,
          motif: dto.motif,
          statutPose: dto.statutPose ?? StatutPose.OK,
          observations: dto.observations,
          lignes: {
            create: await Promise.all(
              lignes.map(async (ligne) => {
                const sku = await tx.cartoucheSku.findUniqueOrThrow({
                  where: {
                    modeleId_couleur: {
                      modeleId: dto.modeleId,
                      couleur: ligne.couleur,
                    },
                  },
                });
                return {
                  couleur: ligne.couleur,
                  qte: ligne.qte,
                  skuId: sku.id,
                };
              }),
            ),
          },
        },
        include: affectationInclude,
      });

      for (const ligne of created.lignes) {
        if (ligne.skuId) await this.stock.recalculer(ligne.skuId, tx);
      }

      return created;
    });
  }

  private normalizeLignes(lignes: CreateAffectationDto['lignes']) {
    const map = new Map<CouleurToner, number>();
    for (const ligne of lignes) {
      const prev = map.get(ligne.couleur) ?? 0;
      map.set(ligne.couleur, prev + ligne.qte);
    }
    if (map.size === 0) {
      throw new BadRequestException('Au moins une ligne couleur requise');
    }
    return [...map.entries()].map(([couleur, qte]) => ({ couleur, qte }));
  }

  private async ensurePrinter(id: string) {
    const p = await this.prisma.imprimante.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Imprimante introuvable');
  }

  private async ensureModele(id: string) {
    const m = await this.prisma.modeleCartouche.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Modele cartouche introuvable');
  }

  private parseHeure(value?: string): Date | null {
    if (!value) return null;
    if (/^\d{1,2}:\d{2}/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('heurePose invalide');
    }
    return parsed;
  }
}
