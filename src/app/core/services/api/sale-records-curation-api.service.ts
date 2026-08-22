import { Injectable, inject } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { SupabaseTransportStateService } from '@core/services/supabase/supabase-transport-state.service';
import { shouldUseSupabaseData } from '@core/auxiliar/supabase-transport.util';
import { ISaleRecordCureResult } from '@core/interfaces/sale-record-cure.interface';
import { SUPABASE_RPC } from '@core/interfaces/report-analytics-rpc.interface';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';

const EMPTY_CURE_RESULT: ISaleRecordCureResult = {
  dryRun: true,
  invalidRemoved: 0,
  aggRemoved: 0,
  summaryRemoved: 0,
  lineCollapsed: 0,
  duplicatesRemoved: 0,
  normalized: 0,
  totalWouldChange: 0,
};

interface CureSaleRecordsRpcPayload {
  dry_run: boolean;
  invalid_removed: number;
  agg_removed: number;
  summary_removed: number;
  line_collapsed: number;
  duplicates_removed: number;
  normalized: number;
  total_would_change: number;
}

/**
 * Applies Excel-aligned curation rules to persisted sale_records via Supabase RPC.
 * Removes invalid/cancelled rows, Shopify order-summary duplicates, and business-key dupes.
 */
@Injectable({ providedIn: 'root' })
export class SaleRecordsCurationApiService {
  private supabase = inject(SupabaseService);
  private env = inject(EnvConfig);
  private health = inject(HealthService);
  private transport = inject(SupabaseTransportStateService);
  private reportCache = inject(ReportSessionCacheService);

  private useSupabase(): boolean {
    return shouldUseSupabaseData(this.env, this.health);
  }

  async previewCure(): Promise<IApiResponse<ISaleRecordCureResult>> {
    return this.runCure(true);
  }

  async applyCure(): Promise<IApiResponse<ISaleRecordCureResult>> {
    return this.runCure(false);
  }

  private async runCure(dryRun: boolean): Promise<IApiResponse<ISaleRecordCureResult>> {
    if (!this.useSupabase()) {
      return {
        success: false,
        statusCode: 503,
        message: 'Supabase is not available.',
        data: EMPTY_CURE_RESULT,
      };
    }

    const client = this.supabase.getClient();
    if (!client) {
      return {
        success: false,
        statusCode: 503,
        message: 'Supabase client is not configured.',
        data: EMPTY_CURE_RESULT,
      };
    }

    this.transport.begin('rpc', 'saleRecords', dryRun ? 'Analyzing sales data…' : 'Curing sales data…');

    try {
      const { data, error } = await client.rpc(SUPABASE_RPC.cureSaleRecords, {
        p_dry_run: dryRun,
      });

      if (error) {
        return {
          success: false,
          statusCode: 400,
          message: error.message,
          data: EMPTY_CURE_RESULT,
        };
      }

      const payload = data as CureSaleRecordsRpcPayload;
      const result: ISaleRecordCureResult = {
        dryRun: payload.dry_run,
        invalidRemoved: payload.invalid_removed ?? 0,
        aggRemoved: payload.agg_removed ?? 0,
        summaryRemoved: payload.summary_removed ?? 0,
        lineCollapsed: payload.line_collapsed ?? 0,
        duplicatesRemoved: payload.duplicates_removed ?? 0,
        normalized: payload.normalized ?? 0,
        totalWouldChange: payload.total_would_change ?? 0,
      };

      if (!dryRun) {
        this.reportCache.invalidateReportForTable('saleRecords');
      }

      return {
        success: true,
        statusCode: 200,
        message: dryRun ? 'Curation preview completed.' : 'Sales data cured successfully.',
        data: result,
      };
    } finally {
      this.transport.end();
    }
  }
}
