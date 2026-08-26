/** Supabase table names and upsert conflict columns. */
export const SUPABASE_TABLES = {
  roles: { table: 'roles', conflictColumn: 'id' },
  profiles: { table: 'profiles', conflictColumn: 'id' },
  userRoles: { table: 'user_roles', conflictColumn: 'user_id,role_id' },
  saleRecords: { table: 'sale_records', conflictColumn: 'id' },
  excelMappings: { table: 'excel_mappings', conflictColumn: 'account_name' },
  products: { table: 'products', conflictColumn: 'sku' },
} as const;

export type SupabaseTableKey = keyof typeof SUPABASE_TABLES;
