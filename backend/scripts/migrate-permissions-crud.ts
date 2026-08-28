import { PrismaClient } from '@prisma/client';
import {
  allPermissionKeys,
  DEFAULT_CRUD_BY_ROLE,
  normalizePermissions,
} from '../src/common/auth/permissions';

const prisma = new PrismaClient();

const SYSTEM_DEFAULTS: Record<string, string[]> = {
  ADMIN: allPermissionKeys(),
  TECHNICIEN: [...DEFAULT_CRUD_BY_ROLE.TECHNICIEN],
  FACTURATION: [...DEFAULT_CRUD_BY_ROLE.FACTURATION],
  LECTURE: [...DEFAULT_CRUD_BY_ROLE.LECTURE],
};

async function main() {
  const roles = await prisma.roleMetier.findMany();
  for (const role of roles) {
    const normalized = normalizePermissions(role.permissions);
    const fallback = SYSTEM_DEFAULTS[role.code];
    const next =
      role.code === 'ADMIN'
        ? allPermissionKeys()
        : normalized.length > 0
          ? normalized
          : fallback ?? [];
    if (JSON.stringify(next.sort()) === JSON.stringify([...role.permissions].sort())) {
      console.log(`  = ${role.code} (déjà CRUD)`);
      continue;
    }
    await prisma.roleMetier.update({
      where: { id: role.id },
      data: { permissions: next },
    });
    console.log(`  ✓ ${role.code}: ${role.permissions.length} → ${next.length} permissions`);
  }

  const users = await prisma.utilisateur.findMany({
    where: { permissions: { isEmpty: false } },
    select: { id: true, permissions: true, roleMetierId: true },
  });
  let userUpdates = 0;
  for (const u of users) {
    const normalized = normalizePermissions(u.permissions);
    if (normalized.length === u.permissions.length && normalized.every((p, i) => p === u.permissions[i])) {
      continue;
    }
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { permissions: normalized },
    });
    userUpdates += 1;
  }

  // Resync users linked to roles
  for (const role of roles) {
    const perms =
      role.code === 'ADMIN'
        ? allPermissionKeys()
        : normalizePermissions(
            (
              await prisma.roleMetier.findUnique({
                where: { id: role.id },
                select: { permissions: true },
              })
            )!.permissions,
          );
    await prisma.utilisateur.updateMany({
      where: { roleMetierId: role.id },
      data: { permissions: perms },
    });
  }

  console.log(`\n✓ Migration CRUD terminée (${userUpdates} utilisateur(s) mis à jour)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
