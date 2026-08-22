import {
  buildReferenceByParent,
  collapseProductsByParent,
  compareParentRepresentatives,
  hydrateProductCatalog,
  normalizeProductCatalogRows,
  productCatalogScore,
  resolveCatalogItemId,
} from './product-catalog.util';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { IReferenceSheetDto } from '@core/interfaces/IReferenceSheetDto.interface';

function product(partial: Partial<IProductDto> & Pick<IProductDto, 'id' | 'parent'>): IProductDto {
  return {
    sku: partial.parent,
    styleName: '',
    isActive: true,
    brand: '',
    division: '',
    type: '',
    collection: '',
    ...partial,
  };
}

describe('product-catalog.util', () => {
  describe('productCatalogScore', () => {
    it('prefers rows with style and catalog metadata', () => {
      const rich = product({
        id: '1',
        parent: 'A1',
        styleName: 'Style A',
        brand: { id: 'b1', name: 'Northline', isActive: true },
      });
      const sparse = product({ id: '2', parent: 'A1' });

      expect(productCatalogScore(rich)).toBeGreaterThan(productCatalogScore(sparse));
    });
  });

  describe('compareParentRepresentatives', () => {
    it('prefers active SKUs over inactive ones', () => {
      const active = product({ id: '1', parent: 'A1', isActive: true, styleName: '' });
      const inactive = product({
        id: '2',
        parent: 'A1',
        isActive: false,
        styleName: 'Rich inactive',
        brand: 'Northline',
      });

      expect(compareParentRepresentatives(active, inactive)).toBeLessThan(0);
      expect(compareParentRepresentatives(inactive, active)).toBeGreaterThan(0);
    });

    it('breaks score ties by id', () => {
      const a = product({ id: 'aaa', parent: 'A1', styleName: 'Same' });
      const b = product({ id: 'bbb', parent: 'A1', styleName: 'Same' });

      expect(compareParentRepresentatives(a, b)).toBeLessThan(0);
      expect(compareParentRepresentatives(b, a)).toBeGreaterThan(0);
    });
  });

  describe('collapseProductsByParent', () => {
    it('returns one row per parent preferring active SKU with metadata', () => {
      const rows = [
        product({ id: '1', parent: 'Z100', isActive: false, styleName: 'Inactive rich', brand: 'Northline' }),
        product({ id: '2', parent: 'Z100', isActive: true, styleName: 'Active' }),
        product({ id: '3', parent: 'A200', isActive: true, styleName: 'Alpha' }),
      ];

      const collapsed = collapseProductsByParent(rows);

      expect(collapsed.length).toBe(2);
      expect(collapsed.find(row => row.parent === 'Z100')?.id).toBe('2');
      expect(collapsed.find(row => row.parent === 'Z100')?.sku).toBe('Z100');
      expect(collapsed.map(row => row.parent)).toEqual(['A200', 'Z100']);
    });
  });

  describe('resolveCatalogItemId', () => {
    const brands = [{ id: 'brand-1', name: 'Northline', isActive: true }];

    it('resolves object ids', () => {
      expect(resolveCatalogItemId({ id: 'brand-1', name: 'Northline', isActive: true }, brands)).toBe(
        'brand-1'
      );
    });

    it('resolves string labels case-insensitively', () => {
      expect(resolveCatalogItemId('northline', brands)).toBe('brand-1');
    });
  });

  describe('hydrateProductCatalog', () => {
    it('fills missing labels from reference_sheets', () => {
      const referenceByParent = buildReferenceByParent([
        {
          id: 'ref-1',
          parent: 'A100',
          styleName: 'Ref Style',
          brand: 'Northline',
          div: 'Women',
          type: 'Top',
          collection: 'Core',
          fit: 'Regular',
        } as IReferenceSheetDto,
      ]);

      const hydrated = hydrateProductCatalog(product({ id: '1', parent: 'A100' }), {
        brands: [{ id: 'b1', name: 'Northline', isActive: true }],
        divisions: [{ id: 'd1', name: 'Women', isActive: true }],
        types: [{ id: 't1', name: 'Top', isActive: true }],
        collections: [{ id: 'c1', name: 'Core', isActive: true }],
        fits: [{ id: 'f1', name: 'Regular', isActive: true }],
        referenceByParent,
      });

      expect(hydrated.styleName).toBe('Ref Style');
      expect(hydrated.brand).toEqual({ id: 'b1', name: 'Northline', isActive: true });
      expect(hydrated.sku).toBe('A100');
    });
  });

  describe('normalizeProductCatalogRows', () => {
    it('collapses and hydrates in one pass', () => {
      const ctx = {
        brands: [{ id: 'b1', name: 'Northline', isActive: true }],
        divisions: [],
        types: [],
        collections: [],
        fits: [],
        referenceByParent: buildReferenceByParent([
          {
            id: 'ref-1',
            parent: 'P1',
            styleName: 'From Ref',
            brand: 'Northline',
          } as IReferenceSheetDto,
        ]),
      };

      const rows = [
        product({ id: '1', parent: 'P1', isActive: true }),
        product({ id: '2', parent: 'P1', isActive: false, styleName: 'Other' }),
      ];

      const normalized = normalizeProductCatalogRows(rows, ctx);

      expect(normalized.length).toBe(1);
      expect(normalized[0].styleName).toBe('From Ref');
    });
  });
});
