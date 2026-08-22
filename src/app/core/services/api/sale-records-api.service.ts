import { Injectable, inject, signal } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { ISaleRecordDto, SalesFilters } from '../../interfaces/ISaleRecordDto.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { SalesRecordCurationService } from '@core/services/Excel/sales-record-curation.service';
import { ReportAnalyticsApiService } from '@core/services/api/report-analytics-api.service';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';
import type { BulkUpsertResult } from '@core/interfaces/IBulkUpsertResult.interface';
import { yoyAnalyticsWindowStartIso } from '@core/auxiliar/report-analytics-fetch.util';
import { POSTGREST_MAX_PAGE_SIZE } from '@core/constants/supabase-api.const';
import {
  applySalesTableFiltersToQuery,
  hasActiveSalesTableFilters,
  salesTableFiltersCacheKey,
} from '@core/auxiliar/sales-table-filters.util';

/** Curated read model shared by sales table pagination and get_sales_analytics RPC. */
export const SALES_RECORDS_ANALYTICS_MV = 'sale_records_analytics';

@Injectable({
  providedIn: 'root',
})
export class SaleRecordsApiService extends BaseSupabaseApiService<ISaleRecordDto> {
  protected override tableKey = 'saleRecords' as const;
  /** Newest inserts first (bulk uploads share `created_at`; `id` breaks ties). */
  protected override orderColumn = 'created_at';
  protected override orderTiebreaker = 'id';
  protected override useListCache = false;

  /** Paginated table + YoY fetch read the curated MV; writes stay on sale_records. */
  protected override get listSourceTable(): string {
    return SALES_RECORDS_ANALYTICS_MV;
  }

  private sessionCache = inject(ReportSessionCacheService);
  private curation = inject(SalesRecordCurationService);
  private reportAnalytics = inject(ReportAnalyticsApiService);

  exportProgress = signal({ success: 0, failed: 0 });
  readonly isUploading = this.transportBusy;
  readonly uploadMessage = this.transportMessage;
  readonly uploadProgress = this.transportProgress;

  clearPaginatedTableState(): void {
    // MV rows are already deduped server-side; no cross-page key tracking needed.
  }

  protected override mapRow(row: Record<string, unknown>): ISaleRecordDto {
    return this.curation.curateRecord(super.mapRow(row) as ISaleRecordDto, {
      preserveIsLocal: true,
    });
  }

  async getPaginatedForTable(
    page = 1,
    limit = 20,
    filters?: SalesFilters
  ): Promise<IApiResponse<ISaleRecordDto[]>> {
    const filtered = filters && hasActiveSalesTableFilters(filters);
    const filterKey = filtered ? salesTableFiltersCacheKey(filters!) : '';

    if (filtered) {
      const cached = this.sessionCache.getPaginated<ISaleRecordDto>('sales', page, limit, filterKey);
      if (cached) return cached;
    } else {
      const cached = this.sessionCache.getPaginated<ISaleRecordDto>('sales', page, limit);
      if (cached) return cached;
    }

    if (page === 1) {
      this.clearPaginatedTableState();
    }

    const applyListFilters = filtered
      ? (query: unknown) => applySalesTableFiltersToQuery(query, filters!)
      : undefined;

    this.beginTransport('read', 'Loading sales records…');
    let response: IApiResponse<ISaleRecordDto[]>;
    try {
      response = await this.queryPaginated(page, limit, applyListFilters);
    } finally {
      this.transportState.end();
    }

    const rows = response.data ?? [];
    const next = { ...response, data: rows };

    if (filtered) {
      this.sessionCache.setPaginated('sales', page, limit, next, filterKey);
    } else {
      this.sessionCache.setPaginated('sales', page, limit, next);
    }

    return next;
  }

  override async getPaginated(page = 1, limit = 20): Promise<IApiResponse<ISaleRecordDto[]>> {
    return this.getPaginatedForTable(page, limit);
  }

  override async create(data: Partial<ISaleRecordDto>): Promise<ISaleRecordDto> {
    const result = await super.create(data);
    this.scheduleAnalyticsMaterializedViewRefresh();
    return result;
  }

  override async update(id: string, data: Partial<ISaleRecordDto>): Promise<ISaleRecordDto> {
    const result = await super.update(id, data);
    this.scheduleAnalyticsMaterializedViewRefresh();
    return result;
  }

  override async remove(id: string): Promise<void> {
    await super.remove(id);
    this.scheduleAnalyticsMaterializedViewRefresh();
  }

  override async bulkUpload(data: ISaleRecordDto[]): Promise<IApiResponse<BulkUpsertResult>> {
    const aggBlocked = this.curation.countBlockedAggRows(data);
    if (aggBlocked > 0) {
      return {
        success: false,
        statusCode: 400,
        message:
          `Upload rejected: ${aggBlocked} row(s) with sku "AGG" (monthly subtotals). ` +
          'Import line-item Excel exports only — do not upload pre-aggregated summary sheets.',
        data: { total: 0, persisted: 0, batches: 0, errors: [] },
      };
    }

    const curated = this.curation.curateForUpload(data);
    if (!curated.length) {
      return {
        success: false,
        statusCode: 400,
        message: 'Upload rejected: no valid sale rows after curation (cancel/refund/duplicate rows were removed).',
        data: { total: 0, persisted: 0, batches: 0, errors: [] },
      };
    }

    const result = await super.bulkUpload(curated);
    this.scheduleAnalyticsMaterializedViewRefresh();
    return result;
  }

  /** Full curated MV scan for Excel export (paginates through PostgREST 1k row cap). */
  async fetchAllCuratedForExport(): Promise<ISaleRecordDto[]> {
    return this.fetchAll(POSTGREST_MAX_PAGE_SIZE);
  }

  /** YoY-scoped dataset for charts/insights (current + prior calendar year). */
  async fetchAllForAnalytics(pageSize = 2000): Promise<ISaleRecordDto[]> {
    const cached = this.sessionCache.getFull<ISaleRecordDto>('sales');
    if (cached) return cached;

    const windowStart = yoyAnalyticsWindowStartIso();
    const raw = await this.fetchAllSince('order_place_date', windowStart, pageSize);
    const rows = raw.map(row => this.mapRow(row as unknown as Record<string, unknown>));
    this.sessionCache.setFull('sales', rows);
    return rows;
  }

  protected override prepareRowForUpload(row: Record<string, unknown>): Record<string, unknown> {
    const curated = this.curation.curateRecord(row as unknown as ISaleRecordDto, {
      preserveIsLocal: true,
    });
    return super.prepareRowForUpload(curated as unknown as Record<string, unknown>);
  }

  async exportSales(data: ISaleRecordDto[]): Promise<{ success: number; failed: number; errors: unknown[] }> {
    if (!data?.length) return { success: 0, failed: 0, errors: [] };

    this.exportProgress.set({ success: 0, failed: 0 });

    const curated = this.curation.curateForUpload(data);
    const result = await this.bulkUpload(curated);
    const payload = result.data as { total?: number; errors?: { batch: number; message: string }[] };
    const batchErrors = payload?.errors ?? [];
    const failed = batchErrors.length;
    const success = (payload?.total ?? curated.length) - failed;
    this.exportProgress.set({ success, failed });
    return { success, failed, errors: batchErrors };
  }

  /** Rebuilds `sale_records_analytics` after any `sale_records` mutation. */
  private scheduleAnalyticsMaterializedViewRefresh(): void {
    void this.reportAnalytics.refreshSalesAnalyticsViewInBackground(true);
  }
}
