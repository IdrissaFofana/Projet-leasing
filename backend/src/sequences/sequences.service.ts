import { ConflictException, Injectable } from '@nestjs/common';
import { EntiteSequence, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SequencesService {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(entite: EntiteSequence, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx ?? this.prisma;
    const config = await db.idSequenceConfig.findUnique({ where: { entite } });
    if (!config) {
      throw new ConflictException(`Sequence non configuree pour ${entite}`);
    }

    const updated = await db.idSequenceConfig.update({
      where: { entite },
      data: { dernierNumero: { increment: 1 } },
    });

    const width = config.formatNum.length || 4;
    const num = String(updated.dernierNumero).padStart(width, '0');
    return `${config.prefixe}${num}`;
  }
}
