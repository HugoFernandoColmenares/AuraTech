export interface SkuParts {
  parent: string;
  color: string;
  size: string;
}

export function parseSkuParts(sku: string): SkuParts {
  const parts = (sku || '').split('-');
  return {
    parent: parts[0] || '',
    color: parts[1] || 'N/A',
    size: parts.length > 2 ? parts.slice(2).join('-') || 'N/A' : 'N/A',
  };
}
