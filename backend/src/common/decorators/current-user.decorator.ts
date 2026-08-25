import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ModulePermission } from '../auth/permissions';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...modules: ModulePermission[]) =>
  SetMetadata(PERMISSIONS_KEY, modules);

/** Routes autorisées même si mustChangePassword = true */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';
export const AllowWhileMustChangePassword = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
