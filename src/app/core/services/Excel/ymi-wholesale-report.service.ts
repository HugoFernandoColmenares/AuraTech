import { Injectable, inject } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ReferenceSheetDataService } from './reference-sheet-data.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { resolveReferenceList } from '@core/auxiliar/reference-lookup.utils';
import { AlertService } from '../Utils/alert.service';
import { parseYmiWholesale, validateYmiWholesale } from '@core/excel/parsers';

@Injectable({ providedIn: 'root' })
export class YmiWholesaleReportService {
  private refService = inject(ReferenceSheetDataService);
  private alertService = inject(AlertService);

  transformData(jsonData: Record<string, unknown>[]): ISaleRecordDto[] {
    const validation = validateYmiWholesale(jsonData);
    if (validation) {
      this.alertService.error(validation.title, validation.message);
      throw new Error('YML Wholesale validation failed due to invalid sheet format or empty records.');
    }

    const records = parseYmiWholesale(jsonData, {
      referenceList: resolveReferenceList(this.refService.getReferenceData()(), referenceSheetData),
    });

    if (!records.length) {
      this.alertService.warning(
        'No Records Processed',
        'No valid sales records with both an Order Name and a SKU could be processed from the file.'
      );
    }

    return records;
  }
}
