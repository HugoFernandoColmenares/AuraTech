import { Injectable } from '@angular/core';
import { StoreType } from '@core/interfaces/ISaleRecordDto.interface';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { parseGenericSales } from '@core/excel/parsers';

@Injectable({ providedIn: 'root' })
export class SalesFileHandlerService {
  processFile(storeType: StoreType, rawData: Record<string, unknown>[]): ISaleRecordDto[] {
    if (storeType === 'generic-sales-report') {
      return parseGenericSales(rawData);
    }
    return [];
  }
}
