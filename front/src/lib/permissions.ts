import type { AuthUser, RoleUtilisateur } from './types';

export const MODULES = [
  'dashboard',
  'printers',
  'stock',
  'stock_produits',
  'assignments',
  'readings',
  'campaigns',
  'billing',
  'maintenance',
  'reports',
  'referentiels',
  'users',
  'messages',
  'backups',
] as const;

export type ModulePermission = (typeof MODULES)[number];

export const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export type PermissionKey = `${ModulePermission}:${CrudAction}`;

export const MODULE_LABELS: Record<ModulePermission, string> = {
  dashboard: 'Tableau de bord',
  printers: 'Copieurs',
  stock: 'Stock cartouches (leasing)',
  stock_produits: 'Stock produits',
  assignments: 'Affectations',
  readings: 'Relevés',
  campaigns: 'Campagnes',
  billing: 'Facturation',
  maintenance: 'Maintenance',
  reports: 'Rapports',
  referentiels: 'Référentiels',
  users: 'Gestion utilisateurs',
  messages: 'Messagerie',
  backups: 'Sauvegardes',
};

export const ACTION_LABELS: Record<CrudAction, string> = {
  read: 'Lecture',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
};

export const MODULE_ACTIONS: Record<ModulePermission, readonly CrudAction[]> = {
  dashboard: ['read'],
  messages: ['read', 'create'],
  printers: CRUD_ACTIONS,
  stock: CRUD_ACTIONS,
  stock_produits: CRUD_ACTIONS,
  assignments: CRUD_ACTIONS,
  readings: CRUD_ACTIONS,
  campaigns: CRUD_ACTIONS,
  billing: CRUD_ACTIONS,
  maintenance: CRUD_ACTIONS,
  reports: ['read'],
  referentiels: CRUD_ACTIONS,
  users: CRUD_ACTIONS,
  backups: ['read', 'create'],
};

export function permissionKey(
  module: ModulePermission,
  action: CrudAction,
): PermissionKey {
  return `${module}:${action}`;
}

export function isValidPermissionKey(p: string): p is PermissionKey {
  const [mod, act] = p.split(':');
  return (
    (MODULES as readonly string[]).includes(mod) &&
    (CRUD_ACTIONS as readonly string[]).includes(act)
  );
}

export function expandModulesToCrud(
  modules: ModulePermission[],
  actions: readonly CrudAction[] = CRUD_ACTIONS,
): PermissionKey[] {
  const out: PermissionKey[] = [];
  for (const m of modules) {
    for (const a of MODULE_ACTIONS[m]) {
      if (actions.includes(a)) out.push(permissionKey(m, a));
    }
  }
  return out;
}

export function normalizePermissions(raw: string[]): PermissionKey[] {
  const out = new Set<PermissionKey>();
  for (const p of raw) {
    if (isValidPermissionKey(p)) {
      out.add(p);
      continue;
    }
    if ((MODULES as readonly string[]).includes(p)) {
      for (const a of MODULE_ACTIONS[p as ModulePermission]) {
        out.add(permissionKey(p as ModulePermission, a));
      }
    }
  }
  return [...out];
}

export const DEFAULT_CRUD_BY_ROLE: Record<RoleUtilisateur, PermissionKey[]> = {
  ADMIN: expandModulesToCrud([...MODULES]),
  TECHNICIEN: expandModulesToCrud(
    [
      'dashboard',
      'printers',
      'stock',
      'stock_produits',
      'assignments',
      'readings',
      'campaigns',
      'maintenance',
      'reports',
      'messages',
    ],
    ['read', 'create', 'update'],
  ),
  FACTURATION: [
    ...expandModulesToCrud(
      ['dashboard', 'printers', 'readings', 'campaigns', 'messages', 'reports'],
      ['read'],
    ),
    ...expandModulesToCrud(['billing', 'campaigns'], ['read', 'create', 'update']),
  ],
  LECTURE: expandModulesToCrud(
    [
      'dashboard',
      'printers',
      'stock',
      'stock_produits',
      'readings',
      'campaigns',
      'maintenance',
      'reports',
      'messages',
    ],
    ['read'],
  ),
};

export function resolveUserPermissions(
  user: Pick<AuthUser, 'role' | 'permissions'>,
): PermissionKey[] {
  if (user.role === 'ADMIN') return expandModulesToCrud([...MODULES]);
  if (user.permissions?.length) return normalizePermissions(user.permissions);
  return DEFAULT_CRUD_BY_ROLE[user.role] ?? expandModulesToCrud(['dashboard'], ['read']);
}

export function userHasCrudPermission(
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
  module: ModulePermission,
  action: CrudAction,
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const resolved = resolveUserPermissions(user);
  return resolved.includes(permissionKey(module, action));
}

/** Accès page / module (lecture minimum). */
export function userHasPermission(
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
  module: ModulePermission,
): boolean {
  return userHasCrudPermission(user, module, 'read');
}

export function allPermissionKeys(): PermissionKey[] {
  return expandModulesToCrud([...MODULES]);
}

/** Mappe une route front vers le module permission requis (null = accessible si connecté). */
export function permissionForPath(pathname: string): ModulePermission | null {
  const rules: Array<{ prefix: string; module: ModulePermission }> = [
    { prefix: '/sauvegardes', module: 'backups' },
    { prefix: '/utilisateurs', module: 'users' },
    { prefix: '/referentiels', module: 'referentiels' },
    { prefix: '/admin', module: 'referentiels' },
    { prefix: '/facturation', module: 'billing' },
    { prefix: '/rapports', module: 'reports' },
    { prefix: '/maintenance', module: 'maintenance' },
    { prefix: '/campagnes', module: 'campaigns' },
    { prefix: '/releves', module: 'readings' },
    { prefix: '/affectations', module: 'assignments' },
    { prefix: '/stock-produits', module: 'stock_produits' },
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
