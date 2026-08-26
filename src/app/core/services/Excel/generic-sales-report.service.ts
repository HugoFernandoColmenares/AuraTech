import { Injectable } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { parseGenericSales } from '@core/excel/parsers';

@Injectable({ providedIn: 'root' })
export class GenericSalesReportService {
  transformData(jsonData: Record<string, unknown>[]): ISaleRecordDto[] {
    return parseGenericSales(jsonData);
  }
}
