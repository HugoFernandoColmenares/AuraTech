import { Injectable, inject } from '@angular/core';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { IProductTypeDto, IFitDto } from '@core/interfaces/IBaseCatalogDto.interface';
import { CatalogDataService } from '@core/services/catalog/catalog-data.service';
import { ExcelHandlerService } from './excel-handler.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class ProductExcelImportService {
  private alertService = inject(AlertService);
  private excelHandler = inject(ExcelHandlerService);
  private catalog = inject(CatalogDataService);
  private productService = inject(ProductService);

  async loadFromExcel(file: File): Promise<void> {
    try {
      this.alertService.loading('Processing file...');
      const workbook = await this.excelHandler.parseToWorkbook(file);

      const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'ref sheet');
      if (!sheetName) {
        this.alertService.error('Error', 'The sheet "ref sheet" was not found in the file.');
        return;
      }

      const jsonData = this.excelHandler.getSheetData(workbook, sheetName);
      if (jsonData.length === 0) {
        this.alertService.warning('Warning', 'The sheet is empty.');
        return;
      }

      const brands = this.catalog.brands();
      const divisions = this.catalog.divisions();
      const collections = this.catalog.collections();
      const types = this.catalog.types();
      const fits = this.catalog.fits();

      const newProducts: IProductDto[] = jsonData
        .map(row => {
          const getVal = (keys: string[]) => {
            const key = keys.find(k => row[k] !== undefined);
            return key ? String(row[key]) : '';
          };

          return {
            id: crypto.randomUUID(),
            sku: getVal(['Parent', 'PARENT', 'parent']),
            parent: getVal(['Parent', 'PARENT', 'parent']),
            styleName: getVal(['StyleName', 'Style Name', 'style_name']),
            isActive: true,
            brand: this.resolveCatalogItem(brands, getVal(['Brand', 'BRAND', 'brand'])),
            division: this.resolveCatalogItem(divisions, getVal(['Division', 'DIVISION', 'division'])),
            type: this.resolveCatalogItem(types, getVal(['Type', 'TYPE', 'type', 'ProductType'])),
            collection: this.resolveCatalogItem(collections, getVal(['Collection', 'COLLECTION', 'collection'])),
            fit: row['Fit']
              ? this.resolveCatalogItem(fits, String(row['Fit']))
              : undefined,
            isLocal: true,
          };
        })
        .filter(p => p.parent);

      this.productService.mergeImportedProducts(newProducts);
      this.alertService.success('Import completed', 'New products processed.');
    } catch (error) {
      console.error(error);
      this.alertService.error('Error', 'There was a problem processing the Excel file.');
    }
  }

  private resolveCatalogItem<T extends { id: string; name: string; isActive: boolean }>(
    items: T[],
    name: string
  ): T {
    if (!name) return { id: '', name: 'N/A', isActive: true } as T;
    const existing = items.find(item => item.name.toLowerCase() === name.toLowerCase());
    return existing ?? ({ id: '', name, isActive: true } as T);
  }
}
