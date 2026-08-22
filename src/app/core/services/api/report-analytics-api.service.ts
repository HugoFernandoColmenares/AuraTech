import { Injectable, inject, signal, computed } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { shouldUseSupabaseData } from '@core/auxiliar/supabase-transport.util';
import { SupabaseTransportStateService } from '@core/services/supabase/supabase-transport-state.service';
import {
  CreditCardAnalyticsRpcResponse,
  InventoryAnalyticsRpcResponse,
  SalesAnalyticsRpcResponse,
  SUPABASE_RPC,
} from '@core/interfaces/report-analytics-rpc.interface';
import {
  creditCardFiltersToRpcPayload,
  inventoryFiltersToRpcPayload,
  salesFiltersToRpcPayload,
} from '@core/auxiliar/report-analytics-rpc.mapper';
import { SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { isSupabaseRpcNotFound } from '@core/auxiliar/supabase-timeout.util';

/** Server-side KPI + aggregate bundles via Supabase RPC (Phase 5). */
@Injectable({ providedIn: 'root' })
export class ReportAnalyticsApiService {
  private supabase = inject(SupabaseService);
  private env = inject(EnvConfig);
  private health = inject(HealthService);
  private sessionCache = inject(ReportSessionCacheService);
  private transportState = inject(SupabaseTransportStateService);

  private readonly _salesLoading = signal(false);
  private readonly _creditCardLoading = signal(false);
  private readonly _inventoryLoading = signal(false);

  readonly salesLoading = this._salesLoading.asReadonly();
  readonly creditCardLoading = this._creditCardLoading.asReadonly();
  readonly inventoryLoading = this._inventoryLoading.asReadonly();
  readonly isLoading = computed(
    () => this._salesLoading() || this._creditCardLoading() || this._inventoryLoading()
  );
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

  async fetchCreditCardAnalytics(options: {
    search: string;
    startDate: string;
    endDate: string;
    focusYear: number;
  }): Promise<CreditCardAnalyticsRpcResponse | null> {
    if (!this.useRpc()) return null;

    const filterKey = JSON.stringify(creditCardFiltersToRpcPayload(options));
    const cached = this.sessionCache.getAnalytics<CreditCardAnalyticsRpcResponse>(
      'creditCardAnalytics',
      filterKey
    );
    if (cached) return cached;

    this._creditCardLoading.set(true);
    this.transportState.begin('rpc', 'creditCardAnalytics', 'Loading credit card analytics…');
    try {
      await this.health.whenReady();
      const client = this.supabase.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc(SUPABASE_RPC.creditCardAnalytics, {
        p_filters: creditCardFiltersToRpcPayload(options),
      });

      if (error) {
        console.error('[ReportAnalyticsApiService] get_credit_card_analytics failed:', error.message);
        return null;
      }

      const payload = data as CreditCardAnalyticsRpcResponse;
      this.sessionCache.setAnalytics('creditCardAnalytics', filterKey, payload);
      return payload;
    } finally {
      this._creditCardLoading.set(false);
      this.transportState.end();
    }
  }

  async fetchInventoryAnalytics(filters: {
    search: string;
    division: string;
    type: string;
    excludeZeroAvailable: boolean;
    excludeZeroOnHand: boolean;
  }): Promise<InventoryAnalyticsRpcResponse | null> {
    if (!this.useRpc()) return null;

    const filterKey = JSON.stringify(inventoryFiltersToRpcPayload(filters));
    const cached = this.sessionCache.getAnalytics<InventoryAnalyticsRpcResponse>(
      'inventoryAnalytics',
      filterKey
    );
    if (cached) return cached;

    this._inventoryLoading.set(true);
    this.transportState.begin('rpc', 'inventoryAnalytics', 'Loading inventory analytics…');
    try {
      await this.health.whenReady();
      const client = this.supabase.getClient();
      if (!client) return null;

      const { data, error } = await client.rpc(SUPABASE_RPC.inventoryAnalytics, {
        p_filters: inventoryFiltersToRpcPayload(filters),
      });

      if (error) {
        console.error('[ReportAnalyticsApiService] get_inventory_analytics failed:', error.message);
        return null;
      }

      const payload = data as InventoryAnalyticsRpcResponse;
      this.sessionCache.setAnalytics('inventoryAnalytics', filterKey, payload);
      return payload;
    } finally {
      this._inventoryLoading.set(false);
      this.transportState.end();
    }
  }

  /** Rebuild sale_records_analytics MV after bulk import or cure. */
  async refreshSalesAnalyticsView(concurrent = true): Promise<boolean> {
    if (!this.useRpc()) return false;

    this.transportState.begin('rpc', 'salesAnalytics', 'Refreshing sales analytics…');
    try {
      return await this.refreshSalesAnalyticsMaterializedView(concurrent);
    } finally {
      this.transportState.end();
    }
  }

  /**
   * MV refresh without blocking the global transport overlay.
   * Returns a promise so callers can reload analytics when the refresh completes.
   */
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
          '[ReportAnalyticsApiService] refresh_sale_records_analytics is not deployed — apply migration 20250615100000.'
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
