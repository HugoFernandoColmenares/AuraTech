import { Injectable, inject } from '@angular/core';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { ExcelHandlerService } from './excel-handler.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class ProductExcelImportService {
  private alertService = inject(AlertService);
  private excelHandler = inject(ExcelHandlerService);
  private productService = inject(ProductService);

  async loadFromExcel(file: File): Promise<void> {
    try {
      this.alertService.loading('Processing file...');
      const workbook = await this.excelHandler.parseToWorkbook(file);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        this.alertService.error('Error', 'The workbook has no sheets.');
        return;
      }

      const jsonData = this.excelHandler.getSheetData(workbook, sheetName);
      if (jsonData.length === 0) {
        this.alertService.warning('Warning', 'The sheet is empty.');
        return;
      }

      const newProducts: IProductDto[] = jsonData
        .map(row => {
          const getVal = (keys: string[]) => {
            const key = keys.find(k => row[k] !== undefined);
            return key ? String(row[key]).trim() : '';
          };

          const parent = getVal(['Parent', 'PARENT', 'parent', 'SKU', 'sku']);
          return {
            id: crypto.randomUUID(),
            sku: getVal(['SKU', 'sku']) || parent,
            parent,
            styleName: getVal(['StyleName', 'Style Name', 'style_name', 'Name']),
            isActive: true,
            brand: getVal(['Brand', 'BRAND', 'brand']),
            type: getVal(['Type', 'TYPE', 'type', 'ProductType']),
            collection: getVal(['Collection', 'COLLECTION', 'collection']),
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
}
