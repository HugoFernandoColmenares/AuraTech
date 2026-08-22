import {
  IBrandDto,
  ICollectionDto,
  IDivisionDto,
  IFitDto,
  IProductTypeDto,
} from '@core/interfaces/IBaseCatalogDto.interface';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { IReferenceSheetDto } from '@core/interfaces/IReferenceSheetDto.interface';

type CatalogItem = { id: string; name: string; isActive: boolean };

export interface ProductCatalogHydrateContext {
  brands: IBrandDto[];
  divisions: IDivisionDto[];
  types: IProductTypeDto[];
  collections: ICollectionDto[];
  fits: IFitDto[];
  referenceByParent: Map<string, IReferenceSheetDto>;
}

function catalogFieldScore(value: IProductDto['brand']): number {
  if (!value) return 0;
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  return (value.name?.trim() ? 2 : 0) + (value.id ? 1 : 0);
}

/** Prefer rows with style + catalog metadata (used when collapsing SKU rows). */
export function productCatalogScore(row: IProductDto): number {
  return (
    (row.styleName?.trim() ? 8 : 0) +
    catalogFieldScore(row.brand) * 4 +
    catalogFieldScore(row.division) * 2 +
    catalogFieldScore(row.type) +
    catalogFieldScore(row.collection)
  );
}

/** Active rows win; then metadata score; then stable id tie-break. */
export function compareParentRepresentatives(a: IProductDto, b: IProductDto): number {
  if (a.isActive !== b.isActive) {
    return a.isActive ? -1 : 1;
  }

  const scoreDelta = productCatalogScore(b) - productCatalogScore(a);
  if (scoreDelta !== 0) return scoreDelta;

  const parentCmp = a.parent.localeCompare(b.parent);
  if (parentCmp !== 0) return parentCmp;

  return a.id.localeCompare(b.id);
}

/** Resolves a catalog field (object or string label) to a catalog item id for filters/forms. */
export function resolveCatalogItemId(
  value: IProductDto['brand'],
  items: CatalogItem[]
): string {
  if (!value) return '';
  if (typeof value === 'object' && value.id) return value.id;

  const name = typeof value === 'string' ? value : value.name;
  if (!name?.trim()) return '';

  const hit = items.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  return hit?.id ?? '';
}

/** One catalog row per parent — SKU variants share the same style metadata. */
export function collapseProductsByParent(rows: IProductDto[]): IProductDto[] {
  const byParent = new Map<string, IProductDto>();

  for (const row of rows) {
    const parent = row.parent?.trim();
    if (!parent) continue;

    const key = parent.toLowerCase();
    const candidate = { ...row, parent, sku: parent };
    const existing = byParent.get(key);

    if (!existing || compareParentRepresentatives(candidate, existing) < 0) {
      byParent.set(key, candidate);
    }
  }

  return [...byParent.values()].sort((a, b) => a.parent.localeCompare(b.parent));
}

function resolveCatalogField<T extends CatalogItem>(
  value: IProductDto['brand'],
  items: T[],
  referenceText?: string
): IProductDto['brand'] {
  if (value && typeof value === 'object' && value.id && value.name?.trim()) {
    return value;
  }

  if (value && typeof value === 'object' && value.id) {
    const byId = items.find(item => item.id === value.id);
    if (byId) return byId;
  }

  if (typeof value === 'string' && value.trim()) {
    const byName = items.find(item => item.name.toLowerCase() === value.trim().toLowerCase());
    return byName ?? value.trim();
  }

  if (referenceText?.trim()) {
    const byRef = items.find(item => item.name.toLowerCase() === referenceText.trim().toLowerCase());
    return byRef ?? referenceText.trim();
  }

  return '';
}

function resolveOptionalCatalogField<T extends CatalogItem>(
  value: IProductDto['fit'],
  items: T[],
  referenceText?: string
): IProductDto['fit'] {
  const resolved = resolveCatalogField(value ?? '', items, referenceText);
  return resolved || undefined;
}

/** Fills missing labels from catalog tables and reference_sheets. */
export function hydrateProductCatalog(
  row: IProductDto,
  ctx: ProductCatalogHydrateContext
): IProductDto {
  const ref = ctx.referenceByParent.get(row.parent.toLowerCase());

  return {
    ...row,
    sku: row.parent,
    styleName: row.styleName?.trim() || ref?.styleName?.trim() || '',
    brand: resolveCatalogField(row.brand, ctx.brands, ref?.brand),
    division: resolveCatalogField(row.division, ctx.divisions, ref?.div),
    type: resolveCatalogField(row.type, ctx.types, ref?.type),
    collection: resolveCatalogField(row.collection, ctx.collections, ref?.collection),
    fit: resolveOptionalCatalogField(row.fit, ctx.fits, ref?.fit),
  };
}

export function buildReferenceByParent(
  rows: IReferenceSheetDto[]
): Map<string, IReferenceSheetDto> {
  const map = new Map<string, IReferenceSheetDto>();
  for (const row of rows) {
    const key = row.parent?.trim().toLowerCase();
    if (key && !map.has(key)) {
      map.set(key, row);
    }
  }
  return map;
}

export function normalizeProductCatalogRows(
  skuRows: IProductDto[],
  ctx: ProductCatalogHydrateContext
): IProductDto[] {
  return collapseProductsByParent(skuRows).map(row => hydrateProductCatalog(row, ctx));
}

export function buildProductCatalogHydrateContext(
  brands: IBrandDto[],
  divisions: IDivisionDto[],
  types: IProductTypeDto[],
  collections: ICollectionDto[],
  fits: IFitDto[],
  referenceRows: IReferenceSheetDto[]
): ProductCatalogHydrateContext {
  return {
    brands,
    divisions,
    types,
    collections,
    fits,
    referenceByParent: buildReferenceByParent(referenceRows),
  };
}
