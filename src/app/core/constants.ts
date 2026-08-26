import { ChartConfig, ChartKey } from '@core/interfaces/chart.interface';

export const API_BULK_BATCH_SIZE = 500;
export const POSTGREST_MAX_PAGE_SIZE = 1000;
export const SALES_ANALYTICS_CLIENT_FALLBACK_MAX_ROWS = 10_000;

export const SUPABASE_TABLES = {
  roles: { table: 'roles', conflictColumn: 'id' },
  profiles: { table: 'profiles', conflictColumn: 'id' },
  userRoles: { table: 'user_roles', conflictColumn: 'user_id,role_id' },
  saleRecords: { table: 'sale_records', conflictColumn: 'id' },
  excelMappings: { table: 'excel_mappings', conflictColumn: 'account_name' },
  products: { table: 'products', conflictColumn: 'sku' },
} as const;

export type SupabaseTableKey = keyof typeof SUPABASE_TABLES;

export const SUPABASE_TABLE_LABELS: Record<SupabaseTableKey, string> = {
  roles: 'roles',
  profiles: 'profiles',
  userRoles: 'user roles',
  saleRecords: 'sales records',
  excelMappings: 'excel mappings',
  products: 'products',
};

export function supabaseTableLabel(tableKey: SupabaseTableKey): string {
  return SUPABASE_TABLE_LABELS[tableKey] ?? SUPABASE_TABLES[tableKey].table;
}

export const ROLE_IDS = {
  USER: 'a64a29b9-7116-414d-b4ba-1d9a319fc8ac',
  MANAGER: 'ab138b16-1fe9-4048-b93e-bad7a3c9db02',
  ADMIN: 'bf4cff70-4f9b-47d0-957a-6e0c860b9969',
} as const;

export type RoleKey = keyof typeof ROLE_IDS;

export const ROLE_NORMALIZED = {
  USER: 'USER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type NormalizedRole = (typeof ROLE_NORMALIZED)[keyof typeof ROLE_NORMALIZED];

export const ROLE_ALIASES: Record<string, NormalizedRole> = {
  USER: ROLE_NORMALIZED.USER,
  MANAGER: ROLE_NORMALIZED.MANAGER,
  ADMIN: ROLE_NORMALIZED.ADMIN,
  ADMINISTRATOR: ROLE_NORMALIZED.ADMIN,
};

export type AppPermission =
  | 'read'
  | 'create'
  | 'edit'
  | 'delete'
  | 'bulkUpload'
  | 'dataManagement'
  | 'adminPanel';

const USER_PERMISSIONS: ReadonlySet<AppPermission> = new Set(['read']);

const MANAGER_PERMISSIONS: ReadonlySet<AppPermission> = new Set([
  'read',
  'create',
  'edit',
  'bulkUpload',
]);

const ADMIN_PERMISSIONS: ReadonlySet<AppPermission> = new Set([
  'read',
  'create',
  'edit',
  'delete',
  'bulkUpload',
  'dataManagement',
  'adminPanel',
]);

export const ROLE_HIERARCHY: NormalizedRole[] = [
  ROLE_NORMALIZED.USER,
  ROLE_NORMALIZED.MANAGER,
  ROLE_NORMALIZED.ADMIN,
];

export const PERMISSIONS_BY_ROLE: Record<NormalizedRole, ReadonlySet<AppPermission>> = {
  [ROLE_NORMALIZED.USER]: USER_PERMISSIONS,
  [ROLE_NORMALIZED.MANAGER]: MANAGER_PERMISSIONS,
  [ROLE_NORMALIZED.ADMIN]: ADMIN_PERMISSIONS,
};

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  read: 'View reports and dashboards',
  create: 'Create records and catalog entries',
  edit: 'Edit existing records',
  delete: 'Delete or deactivate records',
  bulkUpload: 'Map Custom Excel and export to database',
  dataManagement: 'Access Data Management tools',
  adminPanel: 'Manage users and roles (Admin Panel)',
};

export const ROLE_CAPABILITY_SUMMARY: Record<NormalizedRole, string> = {
  [ROLE_NORMALIZED.USER]:
    'Read-only access to sales analytics and the product catalog. Cannot import, edit, delete, or open admin tools.',
  [ROLE_NORMALIZED.MANAGER]:
    'Everything User can do, plus create and edit records, map Custom Excel uploads, and export to Supabase. Cannot delete records or access Data Management / Admin Panel.',
  [ROLE_NORMALIZED.ADMIN]:
    'Full platform access: all report CRUD, Custom Excel upload, Data Management (curation, cache, exports), and Admin Panel user/role management.',
};

export interface PivotMonthOption {
  value: number;
  label: string;
}

export const PIVOT_MONTHS: readonly PivotMonthOption[] = [
  { value: 0, label: 'Jan' },
  { value: 1, label: 'Feb' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Apr' },
  { value: 4, label: 'May' },
  { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' },
  { value: 7, label: 'Aug' },
  { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' },
  { value: 10, label: 'Nov' },
  { value: 11, label: 'Dec' },
] as const;

export const CHART_CONFIGS: ChartConfig<ChartKey>[] = [
  { key: 'yoy', label: 'Yearly Comparison', icon: '📅' },
  { key: 'products', label: 'Top Products', icon: '🏷️' },
];
