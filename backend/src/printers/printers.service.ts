import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntiteSequence, Prisma, StatutImprimante } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../sequences/sequences.service';
import { CreatePrinterDto, PrinterQueryDto, UpdatePrinterDto } from './dto/printer.dto';

const printerInclude = {
  marque: true,
  fournisseur: true,
  service: true,
} satisfies Prisma.ImprimanteInclude;

@Injectable()
export class PrintersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
  ) {}

  findAll(query: PrinterQueryDto) {
    const where: Prisma.ImprimanteWhereInput = {};

    if (query.statut) where.statut = query.statut;
    if (query.marqueId) where.marqueId = query.marqueId;
    if (query.localisation) {
      where.localisation = { contains: query.localisation, mode: 'insensitive' };
    }
    if (query.q) {
      where.OR = [
        { code: { contains: query.q, mode: 'insensitive' } },
        { modele: { contains: query.q, mode: 'insensitive' } },
        { numeroSerie: { contains: query.q, mode: 'insensitive' } },
        { localisation: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.imprimante.findMany({
      where,
      include: printerInclude,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const printer = await this.prisma.imprimante.findUnique({
      where: { id },
      include: printerInclude,
    });
    if (!printer) throw new NotFoundException('Imprimante introuvable');
    return printer;
  }

  async findByCode(code: string) {
    const printer = await this.prisma.imprimante.findUnique({
      where: { code },
      include: printerInclude,
    });
    if (!printer) throw new NotFoundException('Imprimante introuvable');
    return printer;
  }

  async create(dto: CreatePrinterDto) {
    const numeroSerie = dto.numeroSerie.trim();
    const exists = await this.prisma.imprimante.findUnique({ where: { numeroSerie } });
    if (exists) throw new ConflictException('Numero de serie deja utilise');

    const marqueId = await this.resolveMarqueId(dto.marqueId, dto.marqueNom);
    const fournisseurId = await this.resolveFournisseurId(dto.fournisseurId, dto.fournisseurNom);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.sequences.nextCode(EntiteSequence.IMPRIMANTE, tx);
      return tx.imprimante.create({
        data: {
          code,
          modele: dto.modele.trim(),
          numeroSerie,
          marqueId,
          fournisseurId,
          serviceId: dto.serviceId,
          localisation: dto.localisation?.trim(),
          statut: dto.statut ?? StatutImprimante.FONCTIONNELLE,
          dateInstallation: dto.dateInstallation ? new Date(dto.dateInstallation) : null,
          prochaineMaintenance: dto.prochaineMaintenance
            ? new Date(dto.prochaineMaintenance)
            : null,
          observations: dto.observations,
        },
        include: printerInclude,
      });
    });
  }

  async update(id: string, dto: UpdatePrinterDto) {
    await this.findOne(id);

    if (dto.numeroSerie) {
      const other = await this.prisma.imprimante.findFirst({
        where: { numeroSerie: dto.numeroSerie.trim(), NOT: { id } },
      });
      if (other) throw new ConflictException('Numero de serie deja utilise');
    }

    return this.prisma.imprimante.update({
      where: { id },
      data: {
        modele: dto.modele?.trim(),
        numeroSerie: dto.numeroSerie?.trim(),
        marqueId: dto.marqueId === undefined ? undefined : dto.marqueId,
        fournisseurId: dto.fournisseurId === undefined ? undefined : dto.fournisseurId,
        serviceId: dto.serviceId === undefined ? undefined : dto.serviceId,
        localisation: dto.localisation === undefined ? undefined : dto.localisation,
        statut: dto.statut,
        dateInstallation:
          dto.dateInstallation === undefined
            ? undefined
            : dto.dateInstallation
              ? new Date(dto.dateInstallation)
              : null,
        prochaineMaintenance:
          dto.prochaineMaintenance === undefined
            ? undefined
            : dto.prochaineMaintenance
              ? new Date(dto.prochaineMaintenance)
              : null,
        observations: dto.observations === undefined ? undefined : dto.observations,
      },
      include: printerInclude,
    });
  }

  /** Soft delete : statut RETIREE */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.imprimante.update({
      where: { id },
      data: { statut: StatutImprimante.RETIREE },
      include: printerInclude,
    });
  }

  private async resolveMarqueId(marqueId?: string, marqueNom?: string) {
    if (marqueId) return marqueId;
    if (!marqueNom) return undefined;
    const nom = this.normalizeBrand(marqueNom);
    const marque = await this.prisma.marque.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
    return marque.id;
  }

  private async resolveFournisseurId(fournisseurId?: string, fournisseurNom?: string) {
    if (fournisseurId) return fournisseurId;
    if (!fournisseurNom) return undefined;
    const nom = fournisseurNom.trim();
    const fournisseur = await this.prisma.fournisseur.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
    return fournisseur.id;
  }

  private normalizeBrand(value: string) {
    const v = value.trim();
    if (v.toUpperCase() === 'CANON') return 'Canon';
    return v;
  }
}
