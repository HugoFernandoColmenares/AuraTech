import { inject, Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import {
  isOnOrAfterIsoDate,
  yoyAnalyticsWindowStartIso,
} from '@core/auxiliar/report-analytics-fetch.util';

@Injectable({ providedIn: 'root' })
export class CreditCardTransactionsApiService extends BaseSupabaseApiService<ICreditCardTransactionDto> {
  protected override tableKey = 'creditCardTransactions' as const;
  protected override orderColumn = 'date';
  protected override useListCache = false;

  private sessionCache = inject(ReportSessionCacheService);

  readonly isUploading = this.transportBusy;
  readonly uploadMessage = this.transportMessage;
  readonly uploadProgress = this.transportProgress;

  override async getPaginated(page = 1, limit = 20): Promise<IApiResponse<ICreditCardTransactionDto[]>> {
    const cached = this.sessionCache.getPaginated<ICreditCardTransactionDto>('creditCard', page, limit);
    if (cached) return cached;

    const response = await super.getPaginated(page, limit);
    this.sessionCache.setPaginated('creditCard', page, limit, response);
    return response;
  }

  /** YoY-scoped dataset for charts/insights (current + prior calendar year). */
  async fetchAllForAnalytics(pageSize = 2000): Promise<ICreditCardTransactionDto[]> {
    const cached = this.sessionCache.getFull<ICreditCardTransactionDto>('creditCard');
    if (cached) return cached;

    const windowStart = yoyAnalyticsWindowStartIso();
    const rows = await this.fetchAllSince('date', windowStart, pageSize);
    this.sessionCache.setFull('creditCard', rows);
    return rows;
  }
}
