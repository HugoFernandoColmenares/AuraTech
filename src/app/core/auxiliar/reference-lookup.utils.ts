import { IReferenceSheetDto } from '@core/interfaces/IReferenceSheetDto.interface';
import { parseSkuParts } from '@core/auxiliar/sku.utils';

export function resolveReferenceList(
  liveData: IReferenceSheetDto[],
  fallback: IReferenceSheetDto[]
): IReferenceSheetDto[] {
  return liveData.length > 0 ? liveData : fallback;
}

export function findReferenceByParent(
  refList: IReferenceSheetDto[],
  parentKey: string
): IReferenceSheetDto | undefined {
  const key = parentKey.toLowerCase();
  return refList.find(item => item.parent.toLowerCase() === key);
}

export function lookupBrandCollection(
  sku: string,
  refList: IReferenceSheetDto[]
): { brand: string; collection: string } {
  const parent = (sku || '').split('-')[0] || '';
  const matched = findReferenceByParent(refList, parent);
  return {
    brand: matched?.brand || 'Unknown',
    collection: matched?.collection || 'None',
  };
}

export function buildStyleNameMap(
  referenceData: { parent: string; styleName: string }[]
): Map<string, string> {
  return new Map(referenceData.map(r => [r.parent.toLowerCase(), r.styleName]));
}

/** Enriches a sales table row with SKU parts and reference style names. */
export function enrichSaleRowWithSku<T extends { sku: string }>(
  row: T,
  styleNameMap: Map<string, string>
): T & { parent: string; color: string; size: string; styleName: string; fullStyleName: string } {
  const parts = (row.sku || '').split('-');
  const { parent, color, size } = parseSkuParts(row.sku);
  const styleName = styleNameMap.get(parent.toLowerCase()) || parent;
  const fullStyleName = parts.length > 1 ? `${styleName}-${parts.slice(1).join('-')}` : styleName;

  return {
    ...row,
    parent,
    color: parts.length > 1 ? parts[1] : '',
    size: parts.length > 2 ? parts.slice(2).join('-') : '',
    styleName,
    fullStyleName,
  };
}
