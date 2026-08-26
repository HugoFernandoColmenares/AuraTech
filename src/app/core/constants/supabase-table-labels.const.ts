import { SUPABASE_TABLES, SupabaseTableKey } from '@core/constants/supabase-tables.const';

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
