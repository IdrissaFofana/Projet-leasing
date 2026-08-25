import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { resolvePermissions } from '../common/auth/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export type RequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (!user || !user.actif) {
      await this.audit
        .log({
          action: 'LOGIN_FAILURE',
          entite: 'auth',
          details: `Tentative échouée pour ${email} (compte inexistant ou inactif)`,
          ipAdresse: meta.ip,
          userAgent: meta.userAgent,
          resultat: 'FAILURE',
        })
        .catch(() => undefined);
      throw new UnauthorizedException('Identifiants invalides');
    }

    const ok = await bcrypt.compare(dto.password, user.motDePasseHash);
    if (!ok) {
      await this.audit
        .log({
          userId: user.id,
          action: 'LOGIN_FAILURE',
          entite: 'auth',
          entiteId: user.id,
          details: `Mot de passe incorrect pour ${email}`,
          ipAdresse: meta.ip,
          userAgent: meta.userAgent,
          resultat: 'FAILURE',
        })
        .catch(() => undefined);
      throw new UnauthorizedException('Identifiants invalides');
    }

    await this.audit
      .log({
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entite: 'auth',
        entiteId: user.id,
        details: user.mustChangePassword
          ? `Connexion ${email} — changement de mot de passe requis`
          : `Connexion ${email}`,
        ipAdresse: meta.ip,
        userAgent: meta.userAgent,
        resultat: 'SUCCESS',
      })
      .catch(() => undefined);

    const permissions = resolvePermissions(user.role, user.permissions);
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role,
        prenom: user.prenom,
        nomFamille: user.nomFamille,
        avatarUrl: user.avatarUrl,
        permissions,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async changePasswordFirst(
    userId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta = {},
  ) {
    const user = await this.prisma.utilisateur.findUnique({ where: { id: userId } });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Session invalide');
    }
    const wasForced = user.mustChangePassword;
    if (!user.mustChangePassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Mot de passe actuel requis');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.motDePasseHash);
      if (!ok) throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const motDePasseHash = await bcrypt.hash(dto.newPassword, 10);
    const updated = await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { motDePasseHash, mustChangePassword: false },
    });

    await this.audit
      .log({
        userId,
        action: 'PASSWORD_CHANGED',
        entite: 'utilisateur',
        entiteId: userId,
        details: wasForced
          ? `Redéfinition obligatoire du mot de passe (${user.email})`
          : `Changement volontaire du mot de passe (${user.email})`,
        ipAdresse: meta.ip,
        userAgent: meta.userAgent,
        resultat: 'SUCCESS',
      })
      .catch(() => undefined);

    const permissions = resolvePermissions(updated.role, updated.permissions);
    return {
      id: updated.id,
      email: updated.email,
      nom: updated.nom,
      role: updated.role,
      prenom: updated.prenom,
      nomFamille: updated.nomFamille,
      avatarUrl: updated.avatarUrl,
      permissions,
      mustChangePassword: false,
    };
  }
}
