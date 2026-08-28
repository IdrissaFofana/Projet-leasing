import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { CrudAction, ModulePermission } from '../auth/permissions';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
};

export type PermissionRequirement = {
  module: ModulePermission;
  action: CrudAction;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);

export const PERMISSIONS_KEY = 'permissions';

/** Exige une permission CRUD sur un module. */
export const RequirePermission = (
  module: ModulePermission,
  action: CrudAction,
) => SetMetadata(PERMISSIONS_KEY, [{ module, action }] as PermissionRequirement[]);

/** Routes autorisées même si mustChangePassword = true */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';
export const AllowWhileMustChangePassword = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
