import { Injectable, inject } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { IInventoryRecordDto } from '@core/interfaces/IInventoryRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { parseYmiInternalInventory, parseYmiInternalSales } from '@core/excel/parsers';

/** @deprecated Prefer pure parsers via {@link SalesFileHandlerService}. */
@Injectable({ providedIn: 'root' })
export class YmiInternalReportService {
  private refService = inject(ReferenceSheetDataService);

  transformSalesData(rawData: Record<string, unknown>[]): ISaleRecordDto[] {
    return parseYmiInternalSales(rawData, {
      referenceList: resolveReferenceList(this.refService.getReferenceData()(), referenceSheetData),
    });
  }

  transformInventoryData(rawData: Record<string, unknown>[]): IInventoryRecordDto[] {
    return parseYmiInternalInventory(rawData);
  }
}
