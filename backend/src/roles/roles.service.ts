import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import {
  allPermissionKeys,
  DEFAULT_CRUD_BY_ROLE,
  isValidPermissionKey,
  normalizePermissions,
  type ModulePermission,
  MODULES,
  resolvePermissions,
} from '../common/auth/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

const SYSTEM_CODES: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.TECHNICIEN,
  RoleUtilisateur.FACTURATION,
  RoleUtilisateur.LECTURE,
];

function filterValidPermissions(perms: string[]): string[] {
  return normalizePermissions(
    perms.filter(
      (p) =>
        isValidPermissionKey(p) ||
        (MODULES as readonly string[]).includes(p),
    ),
  );
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Assure la présence des 4 rôles système. */
  async ensureSystemRoles() {
    for (const code of SYSTEM_CODES) {
      const permissions =
        code === RoleUtilisateur.ADMIN
          ? allPermissionKeys()
          : [...(DEFAULT_CRUD_BY_ROLE[code] ?? [])];
      await this.prisma.roleMetier.upsert({
        where: { code },
        update: {
          permissions: Array.from(
            new Set([
              ...normalizePermissions(await this.existingPerms(code)),
              ...permissions,
            ]),
          ),
          systeme: true,
          actif: true,
        },
        create: {
          code,
          libelle: code.charAt(0) + code.slice(1).toLowerCase(),
          description: `Rôle système ${code}`,
          permissions,
          systeme: true,
          actif: true,
        },
      });
    }
  }

  private async existingPerms(code: string): Promise<string[]> {
    const row = await this.prisma.roleMetier.findUnique({ where: { code } });
    return row?.permissions ?? [];
  }

  async findAll() {
    await this.ensureSystemRoles();
    return this.prisma.roleMetier.findMany({
      orderBy: [{ systeme: 'desc' }, { libelle: 'asc' }],
      include: { _count: { select: { utilisateurs: true } } },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.roleMetier.findUnique({
      where: { id },
      include: {
        _count: { select: { utilisateurs: true } },
        utilisateurs: {
          select: { id: true, nom: true, email: true, actif: true },
          orderBy: { nom: 'asc' },
        },
      },
    });
    if (!role) throw new NotFoundException('Rôle introuvable');
    return role;
  }

  async create(dto: CreateRoleDto) {
    await this.ensureSystemRoles();
    const code = dto.code.trim().toUpperCase();
    if ((SYSTEM_CODES as string[]).includes(code)) {
      throw new BadRequestException('Ce code est réservé à un rôle système');
    }
    const exists = await this.prisma.roleMetier.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Code rôle déjà utilisé');

    const permissions = filterValidPermissions(dto.permissions ?? []);

    return this.prisma.roleMetier.create({
      data: {
        code,
        libelle: dto.libelle.trim(),
        description: dto.description?.trim() || null,
        permissions,
        systeme: false,
        actif: true,
      },
      include: { _count: { select: { utilisateurs: true } } },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const current = await this.findOne(id);
    const permissions =
      dto.permissions === undefined
        ? undefined
        : filterValidPermissions(dto.permissions);

    const finalPerms =
      current.code === 'ADMIN' && permissions !== undefined
        ? allPermissionKeys()
        : permissions;

    const updated = await this.prisma.roleMetier.update({
      where: { id },
      data: {
        libelle: dto.libelle?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        permissions: finalPerms,
        actif: current.systeme && dto.actif === false ? true : dto.actif,
      },
      include: { _count: { select: { utilisateurs: true } } },
    });

    if (finalPerms !== undefined) {
      await this.prisma.utilisateur.updateMany({
        where: { roleMetierId: id },
        data: {
          permissions:
            current.code === 'ADMIN' ? allPermissionKeys() : finalPerms,
        },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.systeme) {
      throw new BadRequestException('Impossible de supprimer un rôle système');
    }
    if (role._count.utilisateurs > 0) {
      throw new BadRequestException(
        'Des utilisateurs sont encore liés à ce rôle — réassignez-les d’abord',
      );
    }
    await this.prisma.roleMetier.delete({ where: { id } });
    return { ok: true };
  }

  resolveAssignment(role: { code: string; permissions: string[] }) {
    const isSystem = (SYSTEM_CODES as string[]).includes(role.code);
    const enumRole = isSystem
      ? (role.code as RoleUtilisateur)
      : RoleUtilisateur.LECTURE;
    const permissions =
      role.code === 'ADMIN'
        ? allPermissionKeys()
        : resolvePermissions(enumRole, role.permissions, { fromRoleMetier: true });
    return { role: enumRole, permissions };
  }
}
