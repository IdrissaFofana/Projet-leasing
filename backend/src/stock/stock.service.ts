import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CouleurToner,
  EntiteSequence,
  Prisma,
  StatutStock,
} from '@prisma/client';
import { computeStatutStock } from '../common/domain/calculs';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../sequences/sequences.service';
import {
  CreateEntreeStockDto,
  CreateEntreesBatchDto,
  CreateModeleCartoucheDto,
  EntreeQueryDto,
  MouvementQueryDto,
  SkuQueryDto,
  UpdateEntreeStockDto,
  UpdateSortieDto,
} from './dto/stock.dto';

const COULEURS: CouleurToner[] = [
  CouleurToner.TONER_BLACK,
  CouleurToner.TONER_CYAN,
  CouleurToner.TONER_MAGENTA,
  CouleurToner.TONER_YELLOW,
];

const skuInclude = {
  modele: { include: { marque: true } },
} satisfies Prisma.CartoucheSkuInclude;

const entreeInclude = {
  modele: { include: { marque: true } },
  sku: true,
  fournisseur: true,
} satisfies Prisma.EntreeStockInclude;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
  ) {}

  findModeles() {
    return this.prisma.modeleCartouche.findMany({
      where: { actif: true },
      include: { marque: true, skus: true },
      orderBy: { modele: 'asc' },
    });
  }

  async createModele(dto: CreateModeleCartoucheDto) {
    const modele = dto.modele.trim();
    let marqueId = dto.marqueId;
    if (!marqueId && dto.marqueNom) {
      const nom = dto.marqueNom.trim();
      const marque = await this.prisma.marque.upsert({
        where: { nom },
        update: {},
        create: { nom },
      });
      marqueId = marque.id;
    }

    const existing = await this.prisma.modeleCartouche.findFirst({
      where: { modele, marqueId: marqueId ?? null },
    });
    if (existing) throw new ConflictException('Modele cartouche deja existant');

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.modeleCartouche.create({
        data: {
          modele,
          marqueId,
          refFabricant: dto.refFabricant?.trim(),
        },
      });
      for (const couleur of COULEURS) {
        await tx.cartoucheSku.create({
          data: { modeleId: created.id, couleur },
        });
      }
      return tx.modeleCartouche.findUniqueOrThrow({
        where: { id: created.id },
        include: { marque: true, skus: true },
      });
    });
  }

  async findSkus(query: SkuQueryDto) {
    const where: Prisma.CartoucheSkuWhereInput = {};
    if (query.modeleId) where.modeleId = query.modeleId;
    if (query.couleur) where.couleur = query.couleur;
    if (query.statut) where.statut = query.statut;
    if (query.alerte === 'true' || query.alerte === '1') {
      where.OR = [
        { statut: StatutStock.EPUISE },
        { statut: StatutStock.AUCUN_STOCK },
        { statut: StatutStock.SUR_AFFECTE },
        { qteRestante: { lte: 2 } },
      ];
    }

    return this.prisma.cartoucheSku.findMany({
      where,
      include: skuInclude,
      orderBy: [{ modele: { modele: 'asc' } }, { couleur: 'asc' }],
    });
  }

  findEntrees(query: EntreeQueryDto) {
    const where: Prisma.EntreeStockWhereInput = {};
    if (query.modeleId) where.modeleId = query.modeleId;
    if (query.couleur) where.couleur = query.couleur;

    return this.prisma.entreeStock.findMany({
      where,
      include: entreeInclude,
      orderBy: [{ dateEntree: 'desc' }, { code: 'desc' }],
    });
  }

  async findMouvements(query: MouvementQueryDto) {
    const modele = await this.prisma.modeleCartouche.findUnique({
      where: { id: query.modeleId },
      include: {
        marque: true,
        skus: { orderBy: { couleur: 'asc' } },
      },
    });
    if (!modele) throw new NotFoundException('Modele cartouche introuvable');

    const [entrees, affectations] = await Promise.all([
      this.prisma.entreeStock.findMany({
        where: { modeleId: query.modeleId },
        include: entreeInclude,
      }),
      this.prisma.affectation.findMany({
        where: { modeleId: query.modeleId },
        include: {
          imprimante: true,
          lignes: { orderBy: { couleur: 'asc' } },
        },
      }),
    ]);

    const mouvements = [
      ...entrees.map((e) => ({
        id: e.id,
        type: 'ENTREE' as const,
        code: e.code,
        date: e.dateEntree,
        heure: e.heureEntree,
        couleur: e.couleur,
        qte: e.qte,
        observations: e.observations,
        detail: e.fournisseur?.nom ?? null,
        imprimante: null,
        fournisseur: e.fournisseur,
        affectationId: null,
      })),
      ...affectations.flatMap((a) =>
        a.lignes.map((l) => ({
          id: l.id,
          type: 'SORTIE' as const,
          code: a.code,
          date: a.datePose,
          heure: a.heurePose,
          couleur: l.couleur,
          qte: l.qte,
          observations: a.observations,
          detail: a.imprimante
            ? `${a.imprimante.code}${a.imprimante.modele ? ` · ${a.imprimante.modele}` : ''}`
            : null,
          imprimante: a.imprimante,
          fournisseur: null,
          affectationId: a.id,
        })),
      ),
    ].sort((a, b) => {
      const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDate !== 0) return byDate;
      const ha = a.heure ? new Date(a.heure).getTime() : 0;
      const hb = b.heure ? new Date(b.heure).getTime() : 0;
      return hb - ha;
    });

    return { modele, skus: modele.skus, mouvements };
  }

  async createEntree(dto: CreateEntreeStockDto) {
    const modele = await this.prisma.modeleCartouche.findUnique({
      where: { id: dto.modeleId },
    });
    if (!modele) throw new NotFoundException('Modele cartouche introuvable');
    if (dto.qte < 1) throw new BadRequestException('Quantite invalide');

    return this.prisma.$transaction(async (tx) => {
      const sku = await this.ensureSku(tx, dto.modeleId, dto.couleur);
      const code = await this.sequences.nextCode(EntiteSequence.ENTREE_STOCK, tx);

      const entree = await tx.entreeStock.create({
        data: {
          code,
          dateEntree: new Date(dto.dateEntree),
          heureEntree: this.parseHeure(dto.heureEntree),
          modeleId: dto.modeleId,
          skuId: sku.id,
          couleur: dto.couleur,
          qte: dto.qte,
          fournisseurId: dto.fournisseurId,
          observations: dto.observations,
        },
        include: entreeInclude,
      });

      await this.recalculer(sku.id, tx);
      return entree;
    });
  }

  async createEntreesBatch(dto: CreateEntreesBatchDto) {
    if (dto.lignes.length === 0) {
      throw new BadRequestException('Au moins une ligne requise');
    }

    for (const ligne of dto.lignes) {
      const modele = await this.prisma.modeleCartouche.findUnique({
        where: { id: ligne.modeleId },
      });
      if (!modele) throw new NotFoundException('Modele cartouche introuvable');
      if (ligne.qte < 1) throw new BadRequestException('Quantite invalide');
    }

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const ligne of dto.lignes) {
        const sku = await this.ensureSku(tx, ligne.modeleId, ligne.couleur);
        const code = await this.sequences.nextCode(EntiteSequence.ENTREE_STOCK, tx);
        const entree = await tx.entreeStock.create({
          data: {
            code,
            dateEntree: new Date(dto.dateEntree),
            heureEntree: this.parseHeure(dto.heureEntree),
            modeleId: ligne.modeleId,
            skuId: sku.id,
            couleur: ligne.couleur,
            qte: ligne.qte,
            fournisseurId: dto.fournisseurId,
            observations: dto.observations,
          },
          include: entreeInclude,
        });
        await this.recalculer(sku.id, tx);
        created.push(entree);
      }
      return created;
    });
  }

  async updateEntree(id: string, dto: UpdateEntreeStockDto) {
    const existing = await this.prisma.entreeStock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Entree stock introuvable');

    const nextCouleur = dto.couleur ?? existing.couleur;
    const nextQte = dto.qte ?? existing.qte;

    return this.prisma.$transaction(async (tx) => {
      const nextSku = await this.ensureSku(tx, existing.modeleId, nextCouleur);
      const oldSku = existing.skuId
        ? await tx.cartoucheSku.findUnique({ where: { id: existing.skuId } })
        : await this.ensureSku(tx, existing.modeleId, existing.couleur);

      if (!oldSku) throw new NotFoundException('SKU introuvable');

      if (nextSku.id === oldSku.id) {
        this.assertRestantSuffisant(oldSku.qteRestante + (nextQte - existing.qte));
      } else {
        this.assertRestantSuffisant(oldSku.qteRestante - existing.qte);
      }

      const updated = await tx.entreeStock.update({
        where: { id },
        data: {
          dateEntree: dto.dateEntree ? new Date(dto.dateEntree) : undefined,
          heureEntree:
            dto.heureEntree !== undefined ? this.parseHeure(dto.heureEntree) : undefined,
          couleur: nextCouleur,
          qte: nextQte,
          skuId: nextSku.id,
          fournisseurId:
            dto.fournisseurId !== undefined ? dto.fournisseurId : undefined,
          observations:
            dto.observations !== undefined ? dto.observations : undefined,
        },
        include: entreeInclude,
      });

      await this.recalculer(oldSku.id, tx);
      if (nextSku.id !== oldSku.id) await this.recalculer(nextSku.id, tx);
      return updated;
    });
  }

  async removeEntree(id: string) {
    const existing = await this.prisma.entreeStock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Entree stock introuvable');

    return this.prisma.$transaction(async (tx) => {
      const sku = existing.skuId
        ? await tx.cartoucheSku.findUnique({ where: { id: existing.skuId } })
        : await this.ensureSku(tx, existing.modeleId, existing.couleur);
      if (!sku) throw new NotFoundException('SKU introuvable');
      this.assertRestantSuffisant(sku.qteRestante - existing.qte);

      await tx.entreeStock.delete({ where: { id } });
      await this.recalculer(sku.id, tx);
      return existing;
    });
  }

  async updateSortie(ligneId: string, dto: UpdateSortieDto) {
    const ligne = await this.prisma.affectationLigne.findUnique({
      where: { id: ligneId },
      include: { affectation: true },
    });
    if (!ligne) throw new NotFoundException('Ligne de sortie introuvable');

    const nextCouleur = dto.couleur ?? ligne.couleur;
    const nextQte = dto.qte ?? ligne.qte;

    return this.prisma.$transaction(async (tx) => {
      if (nextCouleur !== ligne.couleur) {
        const conflict = await tx.affectationLigne.findUnique({
          where: {
            affectationId_couleur: {
              affectationId: ligne.affectationId,
              couleur: nextCouleur,
            },
          },
        });
        if (conflict && conflict.id !== ligne.id) {
          throw new ConflictException(
            'Cette pose a deja une ligne pour cette couleur',
          );
        }
      }

      const nextSku = await this.ensureSku(tx, ligne.affectation.modeleId, nextCouleur);
      const oldSku = ligne.skuId
        ? await tx.cartoucheSku.findUnique({ where: { id: ligne.skuId } })
        : await this.ensureSku(tx, ligne.affectation.modeleId, ligne.couleur);
      if (!oldSku) throw new NotFoundException('SKU introuvable');

      if (nextSku.id === oldSku.id) {
        this.assertRestantSuffisant(oldSku.qteRestante - (nextQte - ligne.qte));
      } else {
        this.assertRestantSuffisant(nextSku.qteRestante - nextQte);
      }

      if (
        dto.datePose ||
        dto.heurePose !== undefined ||
        dto.observations !== undefined
      ) {
        await tx.affectation.update({
          where: { id: ligne.affectationId },
          data: {
            datePose: dto.datePose ? new Date(dto.datePose) : undefined,
            heurePose:
              dto.heurePose !== undefined ? this.parseHeure(dto.heurePose) : undefined,
            observations:
              dto.observations !== undefined ? dto.observations : undefined,
          },
        });
      }

      const updated = await tx.affectationLigne.update({
        where: { id: ligneId },
        data: {
          couleur: nextCouleur,
          qte: nextQte,
          skuId: nextSku.id,
        },
      });

      await this.recalculer(oldSku.id, tx);
      if (nextSku.id !== oldSku.id) await this.recalculer(nextSku.id, tx);
      return updated;
    });
  }

  async removeSortie(ligneId: string) {
    const ligne = await this.prisma.affectationLigne.findUnique({
      where: { id: ligneId },
    });
    if (!ligne) throw new NotFoundException('Ligne de sortie introuvable');

    return this.prisma.$transaction(async (tx) => {
      await tx.affectationLigne.delete({ where: { id: ligneId } });
      const remaining = await tx.affectationLigne.count({
        where: { affectationId: ligne.affectationId },
      });
      if (remaining === 0) {
        await tx.affectation.delete({ where: { id: ligne.affectationId } });
      }
      if (ligne.skuId) await this.recalculer(ligne.skuId, tx);
      return ligne;
    });
  }

  /** Recalcule entrees/sorties/restant + statut pour un SKU. */
  async recalculer(skuId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const sku = await db.cartoucheSku.findUnique({ where: { id: skuId } });
    if (!sku) throw new NotFoundException('SKU introuvable');

    const entreesAgg = await db.entreeStock.aggregate({
      where: { skuId },
      _sum: { qte: true },
    });
    const sortiesAgg = await db.affectationLigne.aggregate({
      where: { skuId },
      _sum: { qte: true },
    });

    const qteEntrees = entreesAgg._sum.qte ?? 0;
    const qteSorties = sortiesAgg._sum.qte ?? 0;
    const qteRestante = qteEntrees - qteSorties;
    const statut = this.computeStatut(qteEntrees, qteSorties, qteRestante);

    return db.cartoucheSku.update({
      where: { id: skuId },
      data: { qteEntrees, qteSorties, qteRestante, statut },
      include: skuInclude,
    });
  }

  private async ensureSku(
    tx: Prisma.TransactionClient,
    modeleId: string,
    couleur: CouleurToner,
  ) {
    return tx.cartoucheSku.upsert({
      where: { modeleId_couleur: { modeleId, couleur } },
      update: {},
      create: { modeleId, couleur },
    });
  }

  private computeStatut(
    qteEntrees: number,
    qteSorties: number,
    qteRestante: number,
  ): StatutStock {
    return computeStatutStock(qteEntrees, qteSorties, qteRestante) as StatutStock;
  }

  private assertRestantSuffisant(nextRestant: number) {
    if (nextRestant < 0) {
      throw new BadRequestException(
        'Stock insuffisant : cette modification rendrait le restant negatif',
      );
    }
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
      throw new BadRequestException('heureEntree invalide');
    }
    return parsed;
  }
}
