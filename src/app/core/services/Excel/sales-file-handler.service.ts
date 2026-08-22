import { Injectable, inject } from '@angular/core';
import { StoreType } from '@core/interfaces/ISaleRecordDto.interface';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { SalesParserContext } from '@core/excel/sales-parser.context';
import { parseGenericSales } from '@core/excel/parsers';

@Injectable({ providedIn: 'root' })
export class SalesFileHandlerService {
  private refService = inject(ReferenceSheetDataService);

  private buildContext(): SalesParserContext {
    return {
      referenceList: resolveReferenceList(
        this.refService.getReferenceData()(),
        referenceSheetData
      ),
    };
  }

  processFile(storeType: StoreType, rawData: Record<string, unknown>[]): ISaleRecordDto[] {
    if (storeType === 'generic-sales-report') {
      return parseGenericSales(rawData, this.buildContext());
    }
    return [];
  }
}
