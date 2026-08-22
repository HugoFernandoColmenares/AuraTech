import { NormalizedRole, ROLE_NORMALIZED } from './roles.const';

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

/** Role hierarchy: higher index wins when multiple roles are assigned. */
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
  bulkUpload: 'Import Excel and export to database',
  dataManagement: 'Access Data Management tools',
  adminPanel: 'Manage users and roles (Admin Panel)',
};

/** Human-readable capability summary per role (shown on Profile). */
export const ROLE_CAPABILITY_SUMMARY: Record<NormalizedRole, string> = {
  [ROLE_NORMALIZED.USER]:
    'Read-only access to sales, inventory, and credit card reports. Cannot import, edit, delete, or open admin tools.',
  [ROLE_NORMALIZED.MANAGER]:
    'Everything User can do, plus create and edit records, import Excel, and export to Supabase. Cannot delete records or access Data Management / Admin Panel.',
  [ROLE_NORMALIZED.ADMIN]:
    'Full platform access: all report CRUD, bulk upload, Data Management (curation, cache, exports), and Admin Panel user/role management.',
};
