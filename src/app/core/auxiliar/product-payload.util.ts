import { camelToSnake, toCamelCaseRecord } from '@core/auxiliar/api-payload.util';
import { IBaseCatalogDto } from '@core/interfaces/IBaseCatalogDto.interface';
import { IProductDto } from '@core/interfaces/IProductDto.interface';

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function mapCatalogEmbed(value: unknown): IBaseCatalogDto | null {
  if (!value || typeof value !== 'object') return null;
  const mapped = toCamelCaseRecord<IBaseCatalogDto>(value as Record<string, unknown>);
  if (!mapped.id || !mapped.name) return null;
  return {
    ...mapped,
    isActive: Boolean(mapped.isActive ?? (value as Record<string, unknown>)['is_active'] ?? true),
  };
}

function extractCatalogId(value: IBaseCatalogDto | string | undefined | null): string | null {
  if (!value) return null;
  if (typeof value === 'object') return value.id || null;
  return null;
}

export interface ProductCatalogIdContext {
  brands: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  types: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  fits: { id: string; name: string }[];
  colors?: { id: string; name: string }[];
  sizes?: { id: string; name: string }[];
}

function resolveCatalogIdFromRef(
  value: IBaseCatalogDto | string | undefined | null,
  items: { id: string; name: string }[]
): string | null {
  if (!value) return null;
  if (typeof value === 'object' && value.id) return value.id;

  const name = typeof value === 'string' ? value : value.name;
  if (!name?.trim()) return null;

  const hit = items.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  return hit?.id ?? null;
}

/** Flat columns from products_enriched — avoids heavy nested embeds on large SKU lists. */
export const ENRICHED_PRODUCT_SELECT_COLUMNS = `
  id,
  sku,
  parent,
  style_name,
  is_active,
  brand_id,
  division_id,
  type_id,
  collection_id,
  fit_id,
  color_id,
  size_id,
  brand_name,
  division_name,
  type_name,
  collection_name,
  fit_name,
  color_name,
  size_name
`;

function catalogFromEnriched(
  id: unknown,
  name: unknown
): IBaseCatalogDto | string {
  const idStr = id != null && String(id).length > 0 ? String(id) : '';
  const nameStr = name != null ? String(name).trim() : '';
  if (idStr && nameStr) {
    return { id: idStr, name: nameStr, isActive: true };
  }
  if (nameStr) return nameStr;
  return '';
}

/** Maps a row from the products_enriched view to {@link IProductDto}. */
export function mapEnrichedProductRow(row: Record<string, unknown>): IProductDto {
  const base = toCamelCaseRecord<Record<string, unknown>>(row);

  return {
    id: String(base['id'] ?? ''),
    sku: String(base['sku'] ?? base['parent'] ?? ''),
    parent: String(base['parent'] ?? ''),
    styleName: String(base['styleName'] ?? ''),
    isActive: Boolean(base['isActive'] ?? true),
    brand: catalogFromEnriched(base['brandId'], base['brandName']),
    division: catalogFromEnriched(base['divisionId'], base['divisionName']),
    type: catalogFromEnriched(base['typeId'], base['typeName']),
    collection: catalogFromEnriched(base['collectionId'], base['collectionName']),
    fit: catalogFromEnriched(base['fitId'], base['fitName']) || undefined,
    color: catalogFromEnriched(base['colorId'], base['colorName']) || undefined,
    size: catalogFromEnriched(base['sizeId'], base['sizeName']) || undefined,
  };
}

/** PostgREST select with catalog FK embeds for SKU-level products. */
export const PRODUCT_SELECT_COLUMNS = `
  *,
  brands ( id, name, is_active ),
  division_clothes ( id, name, is_active ),
  type_clothes ( id, name, is_active ),
  collection_clothes ( id, name, is_active ),
  fit_clothes ( id, name, is_active ),
  colors_clothes ( id, name, is_active ),
  size_clothes ( id, name, is_active )
`;

/** Maps a joined Supabase product row to {@link IProductDto}. */
export function mapSupabaseProductRow(row: Record<string, unknown>): IProductDto {
  const base = toCamelCaseRecord<Record<string, unknown>>(row);

  return {
    id: String(base['id'] ?? ''),
    sku: String(base['sku'] ?? base['parent'] ?? ''),
    parent: String(base['parent'] ?? ''),
    styleName: String(base['styleName'] ?? base['style_name'] ?? ''),
    isActive: Boolean(base['isActive'] ?? base['is_active'] ?? true),
    brand: mapCatalogEmbed(row['brands']) ?? '',
    division: mapCatalogEmbed(row['division_clothes']) ?? '',
    type: mapCatalogEmbed(row['type_clothes']) ?? '',
    collection: mapCatalogEmbed(row['collection_clothes']) ?? '',
    fit: mapCatalogEmbed(row['fit_clothes']) ?? undefined,
    color: mapCatalogEmbed(row['colors_clothes']) ?? undefined,
    size: mapCatalogEmbed(row['size_clothes']) ?? undefined,
  };
}

/** Base table columns returned after create/update on public.products. */
export const PRODUCT_WRITE_SELECT_COLUMNS = `
  id,
  sku,
  parent,
  style_name,
  is_active,
  brand_id,
  division_id,
  type_id,
  collection_id,
  fit_id,
  color_id,
  size_id
`;

/** Converts {@link IProductDto} nested catalog refs to FK columns for Supabase upsert. */
export function prepareProductForUpload(
  product: Record<string, unknown>,
  catalogCtx?: ProductCatalogIdContext
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(product)) {
    if (
      key === 'isLocal' ||
      key === 'brand' ||
      key === 'division' ||
      key === 'type' ||
      key === 'collection' ||
      key === 'fit' ||
      key === 'color' ||
      key === 'size'
    ) {
      continue;
    }
    row[camelToSnake(key)] = serializeValue(value);
  }

  const brandId = catalogCtx
    ? resolveCatalogIdFromRef(product['brand'] as IBaseCatalogDto | string, catalogCtx.brands)
    : extractCatalogId(product['brand'] as IBaseCatalogDto | string);
  const divisionId = catalogCtx
    ? resolveCatalogIdFromRef(product['division'] as IBaseCatalogDto | string, catalogCtx.divisions)
    : extractCatalogId(product['division'] as IBaseCatalogDto | string);
  const typeId = catalogCtx
    ? resolveCatalogIdFromRef(product['type'] as IBaseCatalogDto | string, catalogCtx.types)
    : extractCatalogId(product['type'] as IBaseCatalogDto | string);
  const collectionId = catalogCtx
    ? resolveCatalogIdFromRef(product['collection'] as IBaseCatalogDto | string, catalogCtx.collections)
    : extractCatalogId(product['collection'] as IBaseCatalogDto | string);
  const fitId = catalogCtx
    ? resolveCatalogIdFromRef(product['fit'] as IBaseCatalogDto | string | undefined, catalogCtx.fits)
    : extractCatalogId(product['fit'] as IBaseCatalogDto | string | undefined);
  const colorId = catalogCtx
    ? resolveCatalogIdFromRef(
        product['color'] as IBaseCatalogDto | string | undefined,
        catalogCtx.colors ?? []
      )
    : extractCatalogId(product['color'] as IBaseCatalogDto | string | undefined);
  const sizeId = catalogCtx
    ? resolveCatalogIdFromRef(
        product['size'] as IBaseCatalogDto | string | undefined,
        catalogCtx.sizes ?? []
      )
    : extractCatalogId(product['size'] as IBaseCatalogDto | string | undefined);

  if (brandId) row['brand_id'] = brandId;
  if (divisionId) row['division_id'] = divisionId;
  if (typeId) row['type_id'] = typeId;
  if (collectionId) row['collection_id'] = collectionId;
  if (fitId) row['fit_id'] = fitId;
  if (colorId) row['color_id'] = colorId;
  if (sizeId) row['size_id'] = sizeId;

  return row;
}
