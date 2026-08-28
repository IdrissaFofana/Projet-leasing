import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { allPermissionKeys, resolvePermissions } from '../common/auth/permissions';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      include: {
        roleMetier: {
          select: { id: true, code: true, permissions: true, actif: true },
        },
      },
    });
    if (!user || !user.actif) {
      return null;
    }

    const rm = user.roleMetier?.actif ? user.roleMetier : null;
    const permissions = rm
      ? rm.code === 'ADMIN'
        ? allPermissionKeys()
        : resolvePermissions(user.role, rm.permissions, { fromRoleMetier: true })
      : resolvePermissions(user.role, user.permissions);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
