import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasCrudPermission } from '../auth/permissions';
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  AuthUser,
  PERMISSIONS_KEY,
  type PermissionRequirement,
} from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (user?.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Vous devez changer votre mot de passe avant de continuer',
        );
      }
    }

    const required = this.reflector.getAllAndOverride<PermissionRequirement[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    if (!user) throw new ForbiddenException('Acces refuse');

    const ok = required.some((r) =>
      hasCrudPermission(user.role, user.permissions, r.module, r.action),
    );
    if (!ok) {
      throw new ForbiddenException(
        `Permission insuffisante (${required.map((r) => `${r.module}:${r.action}`).join(' ou ')})`,
      );
    }
    return true;
  }
}
