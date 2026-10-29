/**
 * Single RBAC source of truth for StructStock.
 * Sidebar, route guards, dashboard CTAs, and page actions consume these helpers.
 * Viewer is treated as equivalent to Auditor for read-only gates.
 */

export type AppRole =
  | 'SuperAdmin'
  | 'InventoryManager'
  | 'ProjectManager'
  | 'ProcurementOfficer'
  | 'Storekeeper'
  | 'AccountsOfficer'
  | 'Viewer'
  | 'Auditor';

export type Permission =
  | 'dash.inventory.kpis'
  | 'dash.workqueue'
  | 'nav.dashboard'
  | 'nav.master.materials.view'
  | 'nav.master.materials.write'
  | 'nav.master.categories'
  | 'nav.master.units'
  | 'nav.master.suppliers.view'
  | 'nav.master.suppliers.write'
  | 'nav.master.projects'
  | 'nav.master.warehouses'
  | 'nav.requisitions.view'
  | 'nav.requisitions.write'
  | 'nav.requisitions.approve'
  | 'nav.procurement.po.view'
  | 'nav.procurement.po.write'
  | 'nav.procurement.po.approve'
  | 'nav.procurement.rates'
  | 'nav.receiving.grn.view'
  | 'nav.receiving.grn.write'
  | 'nav.receiving.grn.approve'
  | 'nav.receiving.grn.post'
  | 'nav.inventory.stock'
  | 'nav.inventory.ledger'
  | 'nav.inventory.transfers.view'
  | 'nav.inventory.transfers.write'
  | 'nav.inventory.issues.view'
  | 'nav.inventory.issues.write'
  | 'nav.inventory.issues.approve'
  | 'nav.inventory.returns.view'
  | 'nav.inventory.returns.write'
  | 'nav.inventory.reconciliation'
  | 'nav.reports.centre'
  | 'nav.reports.valuation'
  | 'nav.reports.consumption'
  | 'nav.notifications'
  | 'nav.admin.users'
  | 'nav.admin.settings'
  | 'nav.admin.architecture';

const ALL_PERMISSIONS: Permission[] = [
  'dash.inventory.kpis',
  'dash.workqueue',
  'nav.dashboard',
  'nav.master.materials.view',
  'nav.master.materials.write',
  'nav.master.categories',
  'nav.master.units',
  'nav.master.suppliers.view',
  'nav.master.suppliers.write',
  'nav.master.projects',
  'nav.master.warehouses',
  'nav.requisitions.view',
  'nav.requisitions.write',
  'nav.requisitions.approve',
  'nav.procurement.po.view',
  'nav.procurement.po.write',
  'nav.procurement.po.approve',
  'nav.procurement.rates',
  'nav.receiving.grn.view',
  'nav.receiving.grn.write',
  'nav.receiving.grn.approve',
  'nav.receiving.grn.post',
  'nav.inventory.stock',
  'nav.inventory.ledger',
  'nav.inventory.transfers.view',
  'nav.inventory.transfers.write',
  'nav.inventory.issues.view',
  'nav.inventory.issues.write',
  'nav.inventory.issues.approve',
  'nav.inventory.returns.view',
  'nav.inventory.returns.write',
  'nav.inventory.reconciliation',
  'nav.reports.centre',
  'nav.reports.valuation',
  'nav.reports.consumption',
  'nav.notifications',
  'nav.admin.users',
  'nav.admin.settings',
  'nav.admin.architecture',
];

const INVENTORY_OPS: Permission[] = [
  'dash.inventory.kpis',
  'dash.workqueue',
  'nav.dashboard',
  'nav.master.materials.view',
  'nav.master.warehouses',
  'nav.requisitions.view',
  'nav.requisitions.write',
  'nav.receiving.grn.view',
  'nav.receiving.grn.write',
  'nav.receiving.grn.post',
  'nav.inventory.stock',
  'nav.inventory.ledger',
  'nav.inventory.transfers.view',
  'nav.inventory.transfers.write',
  'nav.inventory.issues.view',
  'nav.inventory.issues.write',
  'nav.inventory.returns.view',
  'nav.inventory.returns.write',
  'nav.reports.centre',
  'nav.reports.consumption',
  'nav.notifications',
];

/** Viewer ≡ Auditor (read-only). */
export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SuperAdmin: [...ALL_PERMISSIONS],

  InventoryManager: [
    ...INVENTORY_OPS,
    'nav.master.materials.write',
    'nav.master.categories',
    'nav.master.units',
    'nav.master.suppliers.view',
    'nav.master.projects',
    'nav.requisitions.approve',
    'nav.receiving.grn.approve',
    'nav.inventory.issues.approve',
    'nav.inventory.reconciliation',
    'nav.reports.valuation',
    'nav.admin.architecture',
  ],

  Storekeeper: [...INVENTORY_OPS],

  ProcurementOfficer: [
    'dash.workqueue',
    'nav.dashboard',
    'nav.master.materials.view',
    'nav.master.suppliers.view',
    'nav.master.suppliers.write',
    'nav.requisitions.view',
    'nav.requisitions.write',
    'nav.procurement.po.view',
    'nav.procurement.po.write',
    'nav.procurement.rates',
    'nav.receiving.grn.view',
    'nav.reports.centre',
    'nav.reports.consumption',
    'nav.notifications',
  ],

  ProjectManager: [
    'dash.inventory.kpis',
    'dash.workqueue',
    'nav.dashboard',
    'nav.requisitions.view',
    'nav.requisitions.write',
    'nav.requisitions.approve',
    'nav.procurement.po.view',
    'nav.procurement.po.approve',
    'nav.procurement.rates',
    'nav.receiving.grn.view',
    'nav.receiving.grn.approve',
    'nav.inventory.stock',
    'nav.inventory.transfers.view',
    'nav.inventory.issues.view',
    'nav.inventory.issues.approve',
    'nav.inventory.returns.view',
    'nav.inventory.reconciliation',
    'nav.reports.centre',
    'nav.reports.valuation',
    'nav.reports.consumption',
    'nav.notifications',
  ],

  AccountsOfficer: [
    'dash.inventory.kpis',
    'dash.workqueue',
    'nav.dashboard',
    'nav.procurement.po.view',
    'nav.receiving.grn.view',
    'nav.receiving.grn.post',
    'nav.inventory.stock',
    'nav.inventory.ledger',
    'nav.inventory.transfers.view',
    'nav.inventory.reconciliation',
    'nav.reports.centre',
    'nav.reports.valuation',
    'nav.reports.consumption',
    'nav.notifications',
  ],

  Viewer: [
    'dash.inventory.kpis',
    'nav.dashboard',
    'nav.inventory.stock',
    'nav.inventory.ledger',
    'nav.inventory.transfers.view',
    'nav.reports.centre',
    'nav.reports.consumption',
    'nav.notifications',
  ],

  Auditor: [
    'dash.inventory.kpis',
    'nav.dashboard',
    'nav.inventory.stock',
    'nav.inventory.ledger',
    'nav.inventory.transfers.view',
    'nav.reports.centre',
    'nav.reports.consumption',
    'nav.notifications',
  ],
};

const ROLE_ALIASES: Record<string, AppRole> = {
  SuperAdmin: 'SuperAdmin',
  InventoryManager: 'InventoryManager',
  ProjectManager: 'ProjectManager',
  ProcurementOfficer: 'ProcurementOfficer',
  Storekeeper: 'Storekeeper',
  AccountsOfficer: 'AccountsOfficer',
  Viewer: 'Viewer',
  Auditor: 'Auditor',
};

export function normalizeRoles(roles: string[] | undefined | null): AppRole[] {
  if (!roles?.length) return [];
  const out = new Set<AppRole>();
  for (const raw of roles) {
    const mapped = ROLE_ALIASES[raw];
    if (mapped) out.add(mapped);
    // Treat Viewer and Auditor as interchangeable for permission checks
    if (raw === 'Viewer') out.add('Auditor');
    if (raw === 'Auditor') out.add('Viewer');
  }
  return [...out];
}

export function permissionsForRoles(roles: string[] | undefined | null): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of normalizeRoles(roles)) {
    for (const p of ROLE_PERMISSIONS[role]) set.add(p);
  }
  return set;
}

export function can(roles: string[] | undefined | null, permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

export function canAny(roles: string[] | undefined | null, permissions: Permission[]): boolean {
  const set = permissionsForRoles(roles);
  return permissions.some((p) => set.has(p));
}

/** Roles that grant a permission — for ProtectedRoute allowedRoles. */
export function rolesFor(permission: Permission): AppRole[] {
  const roles: AppRole[] = [];
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS) as [AppRole, Permission[]][]) {
    if (perms.includes(permission)) roles.push(role);
  }
  // Always include both Viewer and Auditor when either has the permission
  if (roles.includes('Viewer') && !roles.includes('Auditor')) roles.push('Auditor');
  if (roles.includes('Auditor') && !roles.includes('Viewer')) roles.push('Viewer');
  return roles;
}

export function rolesForAny(permissions: Permission[]): AppRole[] {
  const set = new Set<AppRole>();
  for (const p of permissions) {
    for (const r of rolesFor(p)) set.add(r);
  }
  return [...set];
}

/** Org-wide scope (matches backend CurrentUserState.IsGlobal). */
export function isGlobalRole(roles: string[] | undefined | null): boolean {
  return normalizeRoles(roles).some(
    (r) => r === 'SuperAdmin' || r === 'InventoryManager' || r === 'AccountsOfficer'
  );
}
