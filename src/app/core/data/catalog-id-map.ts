/** Catalog UUID lookups. Demo resolves names from the live Supabase catalog cache. */
export type CatalogNameMap = Record<string, string>;

export const BRAND_IDS: CatalogNameMap = {};
export const DIVISION_IDS: CatalogNameMap = {};
export const COLLECTION_IDS: CatalogNameMap = {};
export const TYPE_IDS: CatalogNameMap = {};
export const FIT_IDS: CatalogNameMap = {};
export const SIZE_IDS: CatalogNameMap = {};
export const COLOR_IDS: CatalogNameMap = {};

export function resolveCatalogId(map: CatalogNameMap, name: string | undefined | null): string | null {
  if (!name?.trim()) return null;
  return map[name.trim()] ?? map[name] ?? null;
}
