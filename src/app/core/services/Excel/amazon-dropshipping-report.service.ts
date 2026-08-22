import { Injectable, inject } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { parseAmazonDropshipping } from '@core/excel/parsers';

/** @deprecated Prefer {@link SalesFileHandlerService} + pure parsers. */
@Injectable({ providedIn: 'root' })
export class AmazonDropshippingReportService {
  private refService = inject(ReferenceSheetDataService);

  transformData(jsonData: Record<string, unknown>[]): ISaleRecordDto[] {
    return parseAmazonDropshipping(jsonData, {
      referenceList: resolveReferenceList(this.refService.getReferenceData()(), referenceSheetData),
    });
  }
}
