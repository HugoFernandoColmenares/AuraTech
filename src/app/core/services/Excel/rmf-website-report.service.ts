import { Injectable, inject } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { parseRmfWebsite } from '@core/excel/parsers';

@Injectable({ providedIn: 'root' })
export class RmfWebsiteReportService {
  private refService = inject(ReferenceSheetDataService);

  transformData(jsonData: Record<string, unknown>[]): ISaleRecordDto[] {
    return parseRmfWebsite(jsonData, {
      referenceList: resolveReferenceList(this.refService.getReferenceData()(), referenceSheetData),
    });
  }
}
