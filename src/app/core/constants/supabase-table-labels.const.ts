import { SUPABASE_TABLES, SupabaseTableKey } from '@core/constants/supabase-tables.const';

/** Human-readable labels for Supabase transport overlays. */
export const SUPABASE_TABLE_LABELS: Record<SupabaseTableKey, string> = {
  roles: 'roles',
  profiles: 'profiles',
  userRoles: 'user roles',
  saleRecords: 'sales records',
  inventoryRecords: 'inventory records',
  creditCardTransactions: 'credit card transactions',
  referenceSheets: 'reference sheet',
  channelsCards: 'channel cards',
  mapSheets: 'map sheet',
  mapSheetBudgets: 'map sheet budgets',
  excelMappings: 'excel mappings',
  products: 'products',
  brands: 'brands',
  divisionClothes: 'divisions',
  typeClothes: 'product types',
  collectionClothes: 'collections',
  fitClothes: 'fits',
  sizeClothes: 'sizes',
  colorsClothes: 'colors',
};

export function supabaseTableLabel(tableKey: SupabaseTableKey): string {
  return SUPABASE_TABLE_LABELS[tableKey] ?? SUPABASE_TABLES[tableKey].table;
}
