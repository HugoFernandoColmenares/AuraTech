import { Injectable } from '@angular/core';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';
import { SupabaseTableKey } from '@core/constants';

export type ReportCacheKey = 'sales';
export type AnalyticsCacheKey = 'salesAnalytics';

interface ReportCacheBucket<T> {
  paginated: Map<string, IApiResponse<T[]>>;
  full: T[] | null;
}

/** Maps entity table keys to report session cache buckets (GET cache invalidation on writes). */
export const REPORT_CACHE_BY_TABLE: Partial<Record<SupabaseTableKey, ReportCacheKey>> = {
  saleRecords: 'sales',
};

const ANALYTICS_BY_REPORT: Partial<Record<ReportCacheKey, AnalyticsCacheKey>> = {
  sales: 'salesAnalytics',
};

/**
 * In-memory session cache for report modules.
 * GET responses are reused until a mutating operation (POST/PUT/PATCH/DELETE/bulk) clears the bucket.
 */
@Injectable({ providedIn: 'root' })
export class ReportSessionCacheService {
  private buckets = new Map<ReportCacheKey, ReportCacheBucket<unknown>>();
  private analytics = new Map<AnalyticsCacheKey, Map<string, unknown>>();

  getPaginated<T>(key: ReportCacheKey, page: number, limit: number, filterKey = ''): IApiResponse<T[]> | null {
    const cacheId = filterKey ? `${filterKey}|${page}:${limit}` : `${page}:${limit}`;
    return (this.bucket(key).paginated.get(cacheId) as IApiResponse<T[]>) ?? null;
  }

  setPaginated<T>(
    key: ReportCacheKey,
    page: number,
    limit: number,
    response: IApiResponse<T[]>,
    filterKey = ''
  ): void {
    const cacheId = filterKey ? `${filterKey}|${page}:${limit}` : `${page}:${limit}`;
    this.bucket(key).paginated.set(cacheId, response as IApiResponse<unknown[]>);
  }

  getFull<T>(key: ReportCacheKey): T[] | null {
    return this.bucket(key).full as T[] | null;
  }

  setFull<T>(key: ReportCacheKey, rows: T[]): void {
    this.bucket(key).full = rows as unknown[];
  }

  clearFull(key: ReportCacheKey): void {
    this.bucket(key).full = null;
  }

  getAnalytics<T>(key: AnalyticsCacheKey, filterKey: string): T | null {
    return (this.analytics.get(key)?.get(filterKey) as T) ?? null;
  }

  setAnalytics<T>(key: AnalyticsCacheKey, filterKey: string, payload: T): void {
    if (!this.analytics.has(key)) {
      this.analytics.set(key, new Map());
    }
    this.analytics.get(key)!.set(filterKey, payload as unknown);
  }

  invalidateAnalytics(key?: AnalyticsCacheKey): void {
    if (key) {
      this.analytics.delete(key);
      return;
    }
    this.analytics.clear();
  }

  /** Clears paginated + full + related analytics RPC cache for a report module. */
  invalidateReport(key: ReportCacheKey): void {
    this.buckets.delete(key);
    const analyticsKey = ANALYTICS_BY_REPORT[key];
    if (analyticsKey) {
      this.invalidateAnalytics(analyticsKey);
    }
  }

  invalidateReportForTable(tableKey: SupabaseTableKey): void {
    const reportKey = REPORT_CACHE_BY_TABLE[tableKey];
    if (reportKey) {
      this.invalidateReport(reportKey);
    }
  }

  clearAll(): void {
    this.buckets.clear();
    this.analytics.clear();
  }

  private bucket<T>(key: ReportCacheKey): ReportCacheBucket<T> {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, { paginated: new Map(), full: null });
    }
    return this.buckets.get(key) as ReportCacheBucket<T>;
  }
}
