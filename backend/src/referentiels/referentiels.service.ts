import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNamedDto, UpdateNamedDto } from './dto/named.dto';
import { CreateTarifDto, UpdateTarifDto } from './dto/tarif.dto';

type NamedDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<{ id: string; nom: string } | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

@Injectable()
export class ReferentielsService {
  constructor(private readonly prisma: PrismaService) {}

  private named(kind: 'marque' | 'fournisseur' | 'agent' | 'service'): NamedDelegate {
    return this.prisma[kind] as unknown as NamedDelegate;
  }

  listNamed(kind: 'marque' | 'fournisseur' | 'agent' | 'service') {
    return this.named(kind).findMany({
      orderBy: { nom: 'asc' },
    });
  }

  async createNamed(kind: 'marque' | 'fournisseur' | 'agent' | 'service', dto: CreateNamedDto) {
    const exists = await this.named(kind).findUnique({ where: { nom: dto.nom } });
    if (exists) throw new ConflictException(`${kind} deja existant`);
    return this.named(kind).create({ data: { nom: dto.nom } });
  }

  async updateNamed(kind: 'marque' | 'fournisseur' | 'agent' | 'service', id: string, dto: UpdateNamedDto) {
    const item = await this.named(kind).findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`${kind} introuvable`);
    return this.named(kind).update({ where: { id }, data: dto });
  }

  listTarifs() {
    return this.prisma.tarifLeasing.findMany({ orderBy: { type: 'asc' } });
  }

  async createTarif(dto: CreateTarifDto) {
    const exists = await this.prisma.tarifLeasing.findUnique({ where: { type: dto.type } });
    if (exists) throw new ConflictException('Tarif deja existant pour ce type');
    return this.prisma.tarifLeasing.create({
      data: {
        type: dto.type,
        libelle: dto.libelle,
        prixUnitaire: dto.prixUnitaire,
        devise: dto.devise ?? 'XOF',
      },
    });
  }

  async updateTarif(id: string, dto: UpdateTarifDto) {
    const tarif = await this.prisma.tarifLeasing.findUnique({ where: { id } });
    if (!tarif) throw new NotFoundException('Tarif introuvable');
    return this.prisma.tarifLeasing.update({ where: { id }, data: dto });
  }

  listSequences() {
    return this.prisma.idSequenceConfig.findMany({ orderBy: { entite: 'asc' } });
  }
}
