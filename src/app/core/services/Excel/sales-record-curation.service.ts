import { Injectable } from '@angular/core';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import {
  curateSalesRecord,
  curateSalesRecords,
  CurateSalesRecordsOptions,
  countPreAggregatedUploadRows,
} from '@core/auxiliar/sale-record-curation.util';

/**
 * Shared sales row curation — same rules as Excel channel parsers:
 * dates, audit period, cancelled/refund filter, PG-safe integers, optional dedupe.
 */
@Injectable({ providedIn: 'root' })
export class SalesRecordCurationService {
  curateRecord(record: ISaleRecordDto, options?: CurateSalesRecordsOptions): ISaleRecordDto {
    return curateSalesRecord(record, options);
  }

  curateCollection(
    records: ISaleRecordDto[],
    options?: CurateSalesRecordsOptions
  ): ISaleRecordDto[] {
    return curateSalesRecords(records, options);
  }

  /** Bundled JSON / offline demo rows. */
  curateBundledRows(records: ISaleRecordDto[]): ISaleRecordDto[] {
    return this.curateCollection(records, { dedupe: true, markLocal: true, preserveIsLocal: true });
  }

  /** Rows parsed from Excel before session merge. */
  curateExcelImport(records: ISaleRecordDto[]): ISaleRecordDto[] {
    return this.curateCollection(records, { dedupe: true, markLocal: true });
  }

  /** Supabase reads — drop duplicate business rows and Shopify order-summary dupes. */
  curateFromDatabase(records: ISaleRecordDto[]): ISaleRecordDto[] {
    return this.curateCollection(records, { dedupe: true, preserveIsLocal: true });
  }

  /** Payload sent to PostgREST upsert. Rejects AGG subtotal rows. */
  curateForUpload(records: ISaleRecordDto[]): ISaleRecordDto[] {
    return this.curateCollection(records, { dedupe: true, preserveIsLocal: true });
  }

  countBlockedAggRows(records: ISaleRecordDto[]): number {
    return countPreAggregatedUploadRows(records);
  }
}
