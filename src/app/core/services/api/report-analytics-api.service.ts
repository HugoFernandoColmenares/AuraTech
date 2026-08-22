import { Injectable, inject, signal, computed } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { shouldUseSupabaseData } from '@core/auxiliar/supabase-transport.util';
import { SupabaseTransportStateService } from '@core/services/supabase/supabase-transport-state.service';
import { SalesAnalyticsRpcResponse, SUPABASE_RPC } from '@core/interfaces/report-analytics-rpc.interface';
import { salesFiltersToRpcPayload } from '@core/auxiliar/report-analytics-rpc.mapper';
import { SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { isSupabaseRpcNotFound } from '@core/auxiliar/supabase-timeout.util';

@Injectable({ providedIn: 'root' })
export class ReportAnalyticsApiService {
  private supabase = inject(SupabaseService);
  private env = inject(EnvConfig);
  private health = inject(HealthService);
  private sessionCache = inject(ReportSessionCacheService);
  private transportState = inject(SupabaseTransportStateService);

  private readonly _salesLoading = signal(false);

  readonly salesLoading = this._salesLoading.asReadonly();
  readonly isLoading = computed(() => this._salesLoading());
  readonly transportBusy = this.transportState.isActive;
  readonly transportMessage = this.transportState.message;

  private useRpc(): boolean {
    return shouldUseSupabaseData(this.env, this.health);
  }

  async fetchSalesAnalytics(filters: SalesFilters): Promise<SalesAnalyticsRpcResponse | null> {
    if (!this.useRpc()) return null;

    const filterKey = JSON.stringify(salesFiltersToRpcPayload(filters));
    const cached = this.sessionCache.getAnalytics<SalesAnalyticsRpcResponse>(
      'salesAnalytics',
      filterKey
    );
    if (cached) return cached;

    this._salesLoading.set(true);
    this.transportState.begin('rpc', 'salesAnalytics', 'Loading sales analytics…');
    try {
      await this.health.whenReady();
      const client = this.supabase.getClient();
      if (!client) return null;

      const payload = salesFiltersToRpcPayload(filters);
      const { data, error } = await client.rpc(SUPABASE_RPC.salesAnalytics, {
        p_filters: payload,
      });

      if (error) {
        console.warn('[ReportAnalyticsApiService] get_sales_analytics failed:', error.message);
        return null;
      }

      const response = data as SalesAnalyticsRpcResponse;
      this.sessionCache.setAnalytics('salesAnalytics', filterKey, response);
      return response;
    } finally {
      this._salesLoading.set(false);
      this.transportState.end();
    }
  }

  async refreshSalesAnalyticsView(concurrent = true): Promise<boolean> {
    if (!this.useRpc()) return false;

    this.transportState.begin('rpc', 'salesAnalytics', 'Refreshing sales analytics…');
    try {
      return await this.refreshSalesAnalyticsMaterializedView(concurrent);
    } finally {
      this.transportState.end();
    }
  }

  refreshSalesAnalyticsViewInBackground(concurrent = true): Promise<boolean> {
    if (!this.useRpc()) return Promise.resolve(false);
    return this.refreshSalesAnalyticsMaterializedView(concurrent);
  }

  private async refreshSalesAnalyticsMaterializedView(concurrent: boolean): Promise<boolean> {
    const client = this.supabase.getClient();
    if (!client) return false;

    const { error } = await client.rpc(SUPABASE_RPC.refreshSaleRecordsAnalytics, {
      p_concurrent: concurrent,
    });

    if (error) {
      if (isSupabaseRpcNotFound(error)) {
        console.warn(
          '[ReportAnalyticsApiService] refresh_sale_records_analytics is not deployed.'
        );
      } else {
        console.warn('[ReportAnalyticsApiService] refresh_sale_records_analytics failed:', error.message);
      }
      return false;
    }

    this.sessionCache.invalidateReport('sales');
    return true;
  }
}
