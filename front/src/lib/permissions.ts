import type { AuthUser, RoleUtilisateur } from './types';

export const MODULES = [
  'dashboard',
  'printers',
  'stock',
  'assignments',
  'readings',
  'campaigns',
  'billing',
  'maintenance',
  'referentiels',
  'users',
  'messages',
] as const;

export type ModulePermission = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModulePermission, string> = {
  dashboard: 'Tableau de bord',
  printers: 'Imprimantes',
  stock: 'Stock',
  assignments: 'Affectations',
  readings: 'Relevés',
  campaigns: 'Campagnes',
  billing: 'Facturation',
  maintenance: 'Maintenance',
  referentiels: 'Référentiels',
  users: 'Gestion utilisateurs',
  messages: 'Messagerie',
};

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<RoleUtilisateur, ModulePermission[]> = {
  ADMIN: [...MODULES],
  TECHNICIEN: [
    'dashboard',
    'printers',
    'stock',
    'assignments',
    'readings',
    'campaigns',
    'maintenance',
    'messages',
  ],
  FACTURATION: [
    'dashboard',
    'printers',
    'readings',
    'campaigns',
    'billing',
    'messages',
  ],
  LECTURE: [
    'dashboard',
    'printers',
    'stock',
    'readings',
    'campaigns',
    'maintenance',
    'messages',
  ],
};

export function userHasPermission(
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
  module: ModulePermission,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const list = user.permissions?.length
    ? user.permissions
    : DEFAULT_PERMISSIONS_BY_ROLE[user.role] ?? [];
  return list.includes(module);
}

/** Mappe une route front vers le module permission requis (null = accessible si connecté). */
export function permissionForPath(pathname: string): ModulePermission | null {
  const rules: Array<{ prefix: string; module: ModulePermission }> = [
    { prefix: '/utilisateurs', module: 'users' },
    { prefix: '/referentiels', module: 'referentiels' },
    { prefix: '/admin', module: 'referentiels' },
    { prefix: '/facturation', module: 'billing' },
    { prefix: '/maintenance', module: 'maintenance' },
    { prefix: '/campagnes', module: 'campaigns' },
    { prefix: '/releves', module: 'readings' },
    { prefix: '/affectations', module: 'assignments' },
    { prefix: '/stock', module: 'stock' },
    { prefix: '/imprimantes', module: 'printers' },
    { prefix: '/messagerie', module: 'messages' },
  ];
  const hit = rules.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (hit) return hit.module;
  if (pathname === '/' || pathname === '') return 'dashboard';
  return null;
}
