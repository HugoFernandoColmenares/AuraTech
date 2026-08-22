/** Supabase table names and upsert conflict columns (Phase 2+ data migration). */
export const SUPABASE_TABLES = {
  roles: { table: 'roles', conflictColumn: 'id' },
  profiles: { table: 'profiles', conflictColumn: 'id' },
  userRoles: { table: 'user_roles', conflictColumn: 'user_id,role_id' },
  saleRecords: { table: 'sale_records', conflictColumn: 'id' },
  referenceSheets: { table: 'reference_sheets', conflictColumn: 'parent' },
  excelMappings: { table: 'excel_mappings', conflictColumn: 'account_name' },
  products: { table: 'products', conflictColumn: 'sku' },
  brands: { table: 'brands', conflictColumn: 'name' },
  divisionClothes: { table: 'division_clothes', conflictColumn: 'name' },
  typeClothes: { table: 'type_clothes', conflictColumn: 'name' },
  collectionClothes: { table: 'collection_clothes', conflictColumn: 'name' },
  fitClothes: { table: 'fit_clothes', conflictColumn: 'name' },
  sizeClothes: { table: 'size_clothes', conflictColumn: 'name' },
  colorsClothes: { table: 'colors_clothes', conflictColumn: 'name' },
} as const;

export type SupabaseTableKey = keyof typeof SUPABASE_TABLES;
