/** Modules / fonctionnalités exposés dans l’UI et les guards. */
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
  users: 'Utilisateurs',
  messages: 'Messagerie',
};

/** Permissions par défaut selon le rôle métier. */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, ModulePermission[]> = {
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

export function resolvePermissions(
  role: string,
  custom?: string[] | null,
  opts?: { fromRoleMetier?: boolean },
): ModulePermission[] {
  if (role === 'ADMIN') return [...MODULES];
  // Permissions issues d’un RoleMetier : la liste (même vide) fait foi
  if (opts?.fromRoleMetier && Array.isArray(custom)) {
    return custom.filter((p): p is ModulePermission =>
      (MODULES as readonly string[]).includes(p),
    );
  }
  if (custom && custom.length > 0) {
    return custom.filter((p): p is ModulePermission =>
      (MODULES as readonly string[]).includes(p),
    );
  }
  return DEFAULT_PERMISSIONS_BY_ROLE[role] ?? ['dashboard'];
}

export function hasPermission(
  role: string,
  permissions: string[] | null | undefined,
  module: ModulePermission,
  opts?: { fromRoleMetier?: boolean },
): boolean {
  if (role === 'ADMIN') return true;
  const resolved = resolvePermissions(role, permissions, opts);
  return resolved.includes(module);
}

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
