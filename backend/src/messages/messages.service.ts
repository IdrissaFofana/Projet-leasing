import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto } from './dto/message.dto';

type Peer = { id: string; nom: string; email: string; role?: string };

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  directory(excludeUserId: string) {
    return this.prisma.utilisateur.findMany({
      where: { actif: true, id: { not: excludeUserId } },
      select: { id: true, nom: true, email: true, role: true },
      orderBy: { nom: 'asc' },
    });
  }

  inbox(userId: string, limit = 40) {
    return this.prisma.messageInterne.findMany({
      where: { destinataireId: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        expediteur: { select: { id: true, nom: true, email: true } },
      },
    });
  }

  sent(userId: string, limit = 40) {
    return this.prisma.messageInterne.findMany({
      where: { expediteurId: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        destinataire: { select: { id: true, nom: true, email: true } },
      },
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.messageInterne.count({
      where: { destinataireId: userId, luAt: null },
    });
  }

  /** Liste des conversations (1 entrée par interlocuteur), style WhatsApp. */
  async conversations(userId: string) {
    const messages = await this.prisma.messageInterne.findMany({
      where: {
        OR: [{ expediteurId: userId }, { destinataireId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        expediteur: { select: { id: true, nom: true, email: true, role: true } },
        destinataire: { select: { id: true, nom: true, email: true, role: true } },
      },
    });

    const map = new Map<
      string,
      {
        peer: Peer;
        lastMessage: {
          id: string;
          corps: string;
          sujet: string;
          createdAt: Date;
          fromMe: boolean;
        };
        unreadCount: number;
      }
    >();

    for (const m of messages) {
      const peer =
        m.expediteurId === userId
          ? (m.destinataire as Peer)
          : (m.expediteur as Peer);
      const existing = map.get(peer.id);
      if (!existing) {
        map.set(peer.id, {
          peer,
          lastMessage: {
            id: m.id,
            corps: m.corps,
            sujet: m.sujet,
            createdAt: m.createdAt,
            fromMe: m.expediteurId === userId,
          },
          unreadCount:
            m.destinataireId === userId && !m.luAt ? 1 : 0,
        });
      } else if (m.destinataireId === userId && !m.luAt) {
        existing.unreadCount += 1;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
    );
  }

  /** Fil de discussion avec un utilisateur. */
  async thread(userId: string, peerId: string) {
    const peer = await this.prisma.utilisateur.findFirst({
      where: { id: peerId, actif: true },
      select: { id: true, nom: true, email: true, role: true },
    });
    if (!peer) throw new NotFoundException('Interlocuteur introuvable');

    const messages = await this.prisma.messageInterne.findMany({
      where: {
        OR: [
          { expediteurId: userId, destinataireId: peerId },
          { expediteurId: peerId, destinataireId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
      include: {
        expediteur: { select: { id: true, nom: true, email: true } },
        destinataire: { select: { id: true, nom: true, email: true } },
      },
    });

    // Marquer comme lus les messages reçus dans ce fil
    await this.prisma.messageInterne.updateMany({
      where: {
        expediteurId: peerId,
        destinataireId: userId,
        luAt: null,
      },
      data: { luAt: new Date() },
    });

    return { peer, messages };
  }

  async send(expediteurId: string, dto: CreateMessageDto) {
    if (dto.destinataireId === expediteurId) {
      throw new BadRequestException('Impossible de vous écrire à vous-même');
    }
    const dest = await this.prisma.utilisateur.findFirst({
      where: { id: dto.destinataireId, actif: true },
    });
    if (!dest) throw new NotFoundException('Destinataire introuvable');

    const expediteur = await this.prisma.utilisateur.findUnique({
      where: { id: expediteurId },
      select: { nom: true },
    });

    const sujet = (dto.sujet?.trim() || 'Message').slice(0, 200);

    const msg = await this.prisma.messageInterne.create({
      data: {
        expediteurId,
        destinataireId: dto.destinataireId,
        sujet,
        corps: dto.corps.trim(),
      },
      include: {
        destinataire: { select: { id: true, nom: true, email: true } },
        expediteur: { select: { id: true, nom: true, email: true } },
      },
    });

    await this.notifications.createMessageNotification({
      destinataireId: dto.destinataireId,
      expediteurNom: expediteur?.nom ?? 'Utilisateur',
      sujet: msg.sujet,
      messageId: msg.id,
    });

    return msg;
  }

  async markRead(userId: string, id: string) {
    const msg = await this.prisma.messageInterne.findFirst({
      where: { id, destinataireId: userId },
      include: {
        expediteur: { select: { id: true, nom: true, email: true } },
      },
    });
    if (!msg) throw new NotFoundException('Message introuvable');
    if (msg.luAt) return msg;
    return this.prisma.messageInterne.update({
      where: { id },
      data: { luAt: new Date() },
      include: {
        expediteur: { select: { id: true, nom: true, email: true } },
      },
    });
  }
}
