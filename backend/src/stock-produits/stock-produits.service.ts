import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutStockProduit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStockProduitDto,
  SortieStockProduitDto,
  StockProduitQueryDto,
  UpdateStockProduitDto,
} from './dto/stock-produit.dto';

const clientInclude = {
  client: { select: { id: true, nom: true, telephone: true, email: true, actif: true } },
} satisfies Prisma.StockProduitInclude;

function parseDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Date invalide: ${value}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Aligné sur le classeur Excel (Mode d'emploi). */
export function computeStatutStockProduit(
  qteRecue: number,
  qteLivree: number,
  dateReception?: Date | null,
): StatutStockProduit {
  if (qteRecue <= 0 || !dateReception) return StatutStockProduit.RECEPTION_EN_ATTENTE;
  if (qteLivree <= 0) return StatutStockProduit.EN_STOCK;
  if (qteLivree >= qteRecue) return StatutStockProduit.LIVRE;
  return StatutStockProduit.PARTIELLEMENT_LIVRE;
}

@Injectable()
export class StockProduitsService {
  constructor(private readonly prisma: PrismaService) {}

  private withRestant<T extends { qteRecue: number; qteLivree: number }>(row: T) {
    return {
      ...row,
      qteRestante: row.qteRecue - row.qteLivree,
    };
  }

  private async resolveClient(clientId?: string | null) {
    if (clientId === undefined) return undefined;
    if (clientId === null || clientId === '') {
      return { clientId: null as string | null, destinataire: null as string | null };
    }
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    if (!client.actif) throw new BadRequestException('Ce client est inactif');
    return { clientId: client.id, destinataire: client.nom };
  }

  async findAll(query: StockProduitQueryDto) {
    const where: Prisma.StockProduitWhereInput = {};
    if (query.statut) where.statut = query.statut;
    if (query.fournisseur) {
      where.fournisseur = { contains: query.fournisseur, mode: 'insensitive' };
    }
    if (query.destinataire) {
      where.OR = [
        { destinataire: { contains: query.destinataire, mode: 'insensitive' } },
        { client: { nom: { contains: query.destinataire, mode: 'insensitive' } } },
      ];
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { designation: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { fournisseur: { contains: q, mode: 'insensitive' } },
        { destinataire: { contains: q, mode: 'insensitive' } },
        { bonReception: { contains: q, mode: 'insensitive' } },
        { bonLivraison: { contains: q, mode: 'insensitive' } },
        { client: { nom: { contains: q, mode: 'insensitive' } } },
      ];
      const asNum = Number(q);
      if (Number.isInteger(asNum) && asNum > 0) {
        where.OR.push({ numero: asNum });
      }
    }

    const rows = await this.prisma.stockProduit.findMany({
      where,
      include: clientInclude,
      orderBy: [{ numero: 'desc' }],
    });
    return rows.map((r) => this.withRestant(r));
  }

  async findOne(id: string) {
    const row = await this.prisma.stockProduit.findUnique({
      where: { id },
      include: clientInclude,
    });
    if (!row) throw new NotFoundException('Ligne stock produit introuvable');
    return this.withRestant(row);
  }

  async summary() {
    const rows = await this.prisma.stockProduit.findMany();
    const byStatut: Record<string, number> = {};
    let qteRecue = 0;
    let qteLivree = 0;
    for (const r of rows) {
      byStatut[r.statut] = (byStatut[r.statut] ?? 0) + 1;
      qteRecue += r.qteRecue;
      qteLivree += r.qteLivree;
    }
    return {
      totalLignes: rows.length,
      qteRecue,
      qteLivree,
      qteRestante: qteRecue - qteLivree,
      byStatut,
    };
  }

  private async nextNumero(tx: Prisma.TransactionClient) {
    const max = await tx.stockProduit.aggregate({ _max: { numero: true } });
    return (max._max.numero ?? 0) + 1;
  }

  async create(dto: CreateStockProduitDto) {
    const qteRecue = dto.qteRecue;
    const qteLivree = dto.qteLivree ?? 0;
    if (qteLivree > qteRecue) {
      throw new BadRequestException('Quantité livrée > quantité reçue');
    }
    const dateReception = parseDate(dto.dateReception) ?? null;
    const dateLivraison = parseDate(dto.dateLivraison) ?? null;
    const statutManuel = Boolean(dto.statutManuel && dto.statut);
    const statut = statutManuel
      ? dto.statut!
      : computeStatutStockProduit(qteRecue, qteLivree, dateReception);

    const clientLink = await this.resolveClient(dto.clientId ?? null);
    const destinataire =
      clientLink?.destinataire ?? (dto.destinataire?.trim() || null);

    return this.prisma.$transaction(async (tx) => {
      const numero = await this.nextNumero(tx);
      const row = await tx.stockProduit.create({
        data: {
          numero,
          designation: dto.designation.trim(),
          reference: dto.reference?.trim() || null,
          fournisseur: dto.fournisseur?.trim() || null,
          qteRecue,
          dateReception,
          bonReception: dto.bonReception?.trim() || null,
          qteLivree,
          dateLivraison,
          destinataire,
          clientId: clientLink?.clientId ?? null,
          bonLivraison: dto.bonLivraison?.trim() || null,
          statut,
          statutManuel,
          observations: dto.observations?.trim() || null,
        },
        include: clientInclude,
      });
      return this.withRestant(row);
    });
  }

  async update(id: string, dto: UpdateStockProduitDto) {
    const current = await this.findOne(id);
    const qteRecue = dto.qteRecue ?? current.qteRecue;
    const qteLivree = dto.qteLivree ?? current.qteLivree;
    if (qteLivree > qteRecue) {
      throw new BadRequestException('Quantité livrée > quantité reçue');
    }

    const dateReception =
      dto.dateReception !== undefined
        ? parseDate(dto.dateReception) ?? null
        : current.dateReception;
    const dateLivraison =
      dto.dateLivraison !== undefined
        ? parseDate(dto.dateLivraison) ?? null
        : current.dateLivraison;

    let statutManuel = current.statutManuel;
    if (dto.statutManuel !== undefined) statutManuel = dto.statutManuel;
    if (dto.statut !== undefined) statutManuel = true;

    const statut = statutManuel
      ? (dto.statut ?? current.statut)
      : computeStatutStockProduit(qteRecue, qteLivree, dateReception);

    const clientLink =
      dto.clientId !== undefined
        ? await this.resolveClient(dto.clientId)
        : undefined;

    const destinataire =
      clientLink !== undefined
        ? clientLink.destinataire
        : dto.destinataire === undefined
          ? undefined
          : dto.destinataire?.trim() || null;

    const row = await this.prisma.stockProduit.update({
      where: { id },
      data: {
        designation: dto.designation?.trim(),
        reference:
          dto.reference === undefined ? undefined : dto.reference?.trim() || null,
        fournisseur:
          dto.fournisseur === undefined
            ? undefined
            : dto.fournisseur?.trim() || null,
        qteRecue,
        dateReception,
        bonReception:
          dto.bonReception === undefined
            ? undefined
            : dto.bonReception?.trim() || null,
        qteLivree,
        dateLivraison,
        destinataire,
        clientId: clientLink !== undefined ? clientLink.clientId : undefined,
        bonLivraison:
          dto.bonLivraison === undefined
            ? undefined
            : dto.bonLivraison?.trim() || null,
        statut,
        statutManuel,
        observations:
          dto.observations === undefined
            ? undefined
            : dto.observations?.trim() || null,
      },
      include: clientInclude,
    });
    return this.withRestant(row);
  }

  async sortie(id: string, dto: SortieStockProduitDto) {
    const current = await this.findOne(id);
    const restant = current.qteRecue - current.qteLivree;
    if (restant <= 0) {
      throw new BadRequestException('Plus de quantité restante pour cette ligne');
    }
    if (dto.qte > restant) {
      throw new BadRequestException(
        `Quantité demandée (${dto.qte}) > restant (${restant})`,
      );
    }

    const clientLink = await this.resolveClient(dto.clientId);
    if (!clientLink?.clientId) {
      throw new BadRequestException('Sélectionnez un client destinataire');
    }

    const qteLivree = current.qteLivree + dto.qte;
    const dateLivraison =
      parseDate(dto.dateLivraison) ??
      current.dateLivraison ??
      new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      );
    const bonLivraison =
      dto.bonLivraison?.trim() || current.bonLivraison || null;
    let observations = current.observations;
    if (dto.observations?.trim()) {
      const note = dto.observations.trim();
      observations = observations ? `${observations}\n${note}` : note;
    }

    const statut = current.statutManuel
      ? current.statut
      : computeStatutStockProduit(current.qteRecue, qteLivree, current.dateReception);

    const row = await this.prisma.stockProduit.update({
      where: { id },
      data: {
        qteLivree,
        dateLivraison,
        destinataire: clientLink.destinataire,
        clientId: clientLink.clientId,
        bonLivraison,
        statut,
        observations,
      },
      include: clientInclude,
    });
    return this.withRestant(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.stockProduit.delete({ where: { id } });
    return { ok: true, id };
  }
}
