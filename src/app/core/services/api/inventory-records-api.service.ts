import { Injectable, inject } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IInventoryRecordDto } from '../../interfaces/IInventoryRecordDto.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';

@Injectable({
  providedIn: 'root',
})
export class InventoryRecordsApiService extends BaseSupabaseApiService<IInventoryRecordDto> {
  protected override tableKey = 'inventoryRecords' as const;
  protected override useListCache = false;

  private sessionCache = inject(ReportSessionCacheService);

  readonly isUploading = this.transportBusy;
  readonly uploadMessage = this.transportMessage;
  readonly uploadProgress = this.transportProgress;

  override async getPaginated(page = 1, limit = 20): Promise<IApiResponse<IInventoryRecordDto[]>> {
    const cached = this.sessionCache.getPaginated<IInventoryRecordDto>('inventory', page, limit);
    if (cached) return cached;

    const response = await super.getPaginated(page, limit);
    this.sessionCache.setPaginated('inventory', page, limit, response);
    return response;
  }

  /** Full dataset for charts / insights (session-cached). */
  async fetchAllForAnalytics(pageSize = 1000): Promise<IInventoryRecordDto[]> {
    const cached = this.sessionCache.getFull<IInventoryRecordDto>('inventory');
    if (cached) return cached;

    const rows = await this.fetchAll(pageSize);
    this.sessionCache.setFull('inventory', rows);
    return rows;
  }
}
