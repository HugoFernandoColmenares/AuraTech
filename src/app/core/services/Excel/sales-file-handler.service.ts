import { Injectable, inject } from '@angular/core';
import { StoreType } from '@core/interfaces/ISaleRecordDto.interface';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { SalesParserContext } from '@core/excel/sales-parser.context';
import {
  parseAmazonDropshipping,
  parseAmazonRetail,
  parseFashionGo,
  parseYmiRetail,
  parseFaire,
  parseYmiInternalSales,
  parseYmiWholesale,
  parseRmfWebsite,
  parseGenericSales,
  parseWalmartWfs,
  validateYmiWholesale,
} from '@core/excel/parsers';
import { AlertService } from '@core/services/Utils/alert.service';

@Injectable({ providedIn: 'root' })
export class SalesFileHandlerService {
  private refService = inject(ReferenceSheetDataService);
  private alertService = inject(AlertService);

  private buildContext(): SalesParserContext {
    return {
      referenceList: resolveReferenceList(
        this.refService.getReferenceData()(),
        referenceSheetData
      ),
    };
  }

  processFile(storeType: StoreType, rawData: Record<string, unknown>[]): ISaleRecordDto[] {
    const ctx = this.buildContext();

    switch (storeType) {
      case 'amazon-dropshipping':
        return parseAmazonDropshipping(rawData, ctx);
      case 'amazon-retail':
        return parseAmazonRetail(rawData, ctx);
      case 'fashion-go':
        return parseFashionGo(rawData, ctx);
      case 'ymi-retail':
        return parseYmiRetail(rawData, ctx);
      case 'faire':
        return parseFaire(rawData, ctx);
      case 'ymi-internal':
        return parseYmiInternalSales(rawData, ctx);
      case 'ymi-wholesale': {
        const validation = validateYmiWholesale(rawData);
        if (validation) {
          this.alertService.error(validation.title, validation.message);
          throw new Error('YML Wholesale validation failed due to invalid sheet format or empty records.');
        }
        const records = parseYmiWholesale(rawData, ctx);
        if (!records.length) {
          this.alertService.warning(
            'No Records Processed',
            'No valid sales records with both an Order Name and a SKU could be processed from the file.'
          );
        }
        return records;
      }
      case 'rmf-website':
        return parseRmfWebsite(rawData, ctx);
      case 'generic-sales-report':
        return parseGenericSales(rawData, ctx);
      case 'walmart-wfs':
        return parseWalmartWfs(rawData, ctx);
      default:
        return [];
    }
  }
}
