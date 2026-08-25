import { SetMetadata } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleUtilisateur[]) => SetMetadata(ROLES_KEY, roles);
