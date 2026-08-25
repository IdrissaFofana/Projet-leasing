import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogInput = {
  userId?: string | null;
  action: string;
  entite?: string;
  entiteId?: string;
  details?: string;
  ipAdresse?: string | null;
  userAgent?: string | null;
  resultat?: 'SUCCESS' | 'FAILURE';
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(params: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entite: params.entite,
        entiteId: params.entiteId,
        details: params.details,
        ipAdresse: params.ipAdresse ?? null,
        userAgent: params.userAgent ?? null,
        resultat: params.resultat ?? 'SUCCESS',
      },
    });
  }

  findRecent(params?: {
    limit?: number;
    userId?: string;
    entite?: string;
    action?: string;
    resultat?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params?.userId) where.userId = params.userId;
    if (params?.entite) where.entite = params.entite;
    if (params?.action) {
      where.action = { contains: params.action, mode: 'insensitive' };
    }
    if (params?.resultat) where.resultat = params.resultat;

    return this.prisma.auditLog.findMany({
      where,
      take: Math.min(params?.limit ?? 100, 500),
      orderBy: { dateHeure: 'desc' },
      include: { user: { select: { id: true, email: true, nom: true, role: true } } },
    });
  }

  findForUser(userId: string, limit = 40) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      take: Math.min(limit, 200),
      orderBy: { dateHeure: 'desc' },
      include: { user: { select: { id: true, email: true, nom: true, role: true } } },
    });
  }
}
