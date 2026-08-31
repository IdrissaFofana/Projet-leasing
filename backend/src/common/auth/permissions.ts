/** Modules / fonctionnalités exposés dans l’UI et les guards. */
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
  referentiels: 'Référentiels',
  users: 'Utilisateurs',
  messages: 'Messagerie',
  backups: 'Sauvegardes',
};

export const ACTION_LABELS: Record<CrudAction, string> = {
  read: 'Lecture',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
};

/** Actions disponibles par module (dashboard/messages = lecture seule). */
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
  referentiels: CRUD_ACTIONS,
  users: CRUD_ACTIONS,
  /** Lecture historique + création = déclenchement manuel */
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

/** Génère toutes les clés CRUD pour une liste de modules. */
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

/** Convertit permissions legacy (module seul) → clés CRUD. */
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

/** Permissions par défaut (CRUD) selon le rôle système. */
export const DEFAULT_CRUD_BY_ROLE: Record<string, PermissionKey[]> = {
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
      'messages',
    ],
    ['read', 'create', 'update'],
  ),
  FACTURATION: [
    ...expandModulesToCrud(
      ['dashboard', 'printers', 'readings', 'campaigns', 'messages'],
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
      'messages',
    ],
    ['read'],
  ),
};

/** @deprecated Utiliser normalizePermissions — conservé pour compat. */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, ModulePermission[]> = {
  ADMIN: [...MODULES],
  TECHNICIEN: [
    'dashboard',
    'printers',
    'stock',
    'stock_produits',
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
    'stock_produits',
    'readings',
    'campaigns',
    'maintenance',
    'messages',
  ],
};

export function resolvePermissions(
  role: string,
  custom?: string[] | null,
  opts?: { fromRoleMetier?: boolean },
): PermissionKey[] {
  if (role === 'ADMIN') return expandModulesToCrud([...MODULES]);
  if (opts?.fromRoleMetier && Array.isArray(custom)) {
    return normalizePermissions(custom);
  }
  if (custom && custom.length > 0) {
    return normalizePermissions(custom);
  }
  return DEFAULT_CRUD_BY_ROLE[role] ?? expandModulesToCrud(['dashboard'], ['read']);
}

export function hasCrudPermission(
  role: string,
  permissions: string[] | null | undefined,
  module: ModulePermission,
  action: CrudAction,
  opts?: { fromRoleMetier?: boolean },
): boolean {
  if (role === 'ADMIN') return true;
  const resolved = resolvePermissions(role, permissions, opts);
  return resolved.includes(permissionKey(module, action));
}

/** Accès au module (au minimum lecture). */
export function hasPermission(
  role: string,
  permissions: string[] | null | undefined,
  module: ModulePermission,
  opts?: { fromRoleMetier?: boolean },
): boolean {
  return hasCrudPermission(role, permissions, module, 'read', opts);
}

export function allPermissionKeys(): PermissionKey[] {
  return expandModulesToCrud([...MODULES]);
}

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
