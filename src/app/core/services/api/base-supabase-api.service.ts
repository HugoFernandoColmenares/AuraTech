import { inject, signal } from '@angular/core';
import { EnvConfig } from '../../config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { shouldUseSupabaseData } from '@core/auxiliar/supabase-transport.util';
import { IApiResponse } from '../../interfaces/IApiResponse.interface';
import type { BulkUpsertResult } from '@core/interfaces/IBulkUpsertResult.interface';
import { API_BULK_BATCH_SIZE, POSTGREST_MAX_PAGE_SIZE } from '@core/constants/supabase-api.const';
import { SUPABASE_TABLES, SupabaseTableKey } from '@core/constants/supabase-tables.const';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { sanitizeForUpload, toCamelCaseRecord } from '@core/auxiliar/api-payload.util';
import { ListCacheManager } from '@core/auxiliar/list-cache-manager.util';
import { SupabaseTransportStateService } from '@core/services/supabase/supabase-transport-state.service';
import { AppBootstrapStateService } from '@core/services/bootstrap/app-bootstrap-state.service';
import { supabaseTableLabel } from '@core/constants/supabase-table-labels.const';
import { AlertService } from '@core/services/Utils/alert.service';
import {
  ACCESS_DENIED_MESSAGE,
  isForbiddenSupabaseError,
} from '@core/auxiliar/supabase-error.util';
import { LocalStorageEntityStore } from '@core/data/local-storage-entity.store';

/**
 * Supabase PostgREST-backed API base for domain entities.
 * Returns empty/demo-safe responses when Supabase is offline or unconfigured.
 */
export abstract class BaseSupabaseApiService<T extends object> {
  protected supabase = inject(SupabaseService);
  protected env = inject(EnvConfig);
  protected health = inject(HealthService);
  private reportCache = inject(ReportSessionCacheService);
  protected transportState = inject(SupabaseTransportStateService);
  private bootstrapState = inject(AppBootstrapStateService);
  private alertService = inject(AlertService);
  private lastForbiddenAlertAt = 0;

  protected abstract tableKey: SupabaseTableKey;

  /** Signal-backed upload/read state for this entity. */
  readonly transportBusy = this.transportState.isActive;
  readonly transportMessage = this.transportState.message;
  readonly transportProgress = this.transportState.progress;

  protected batchSize = API_BULK_BATCH_SIZE;
  protected useListCache = false;
  protected cacheManager = new ListCacheManager<T>(false);

  get cachedItems() {
    return this.cacheManager.cachedItems;
  }

  protected orderColumn = 'created_at';
  protected idColumn = 'id';
  protected selectColumns = '*';

  /**
   * Optional secondary sort column for stable pagination when many rows share
   * the same {@link orderColumn} value (e.g. a bulk upsert inserts rows with
   * identical `created_at`). When set, queries chain `.order(orderTiebreaker)`.
   */
  protected orderTiebreaker: string | null = null;

  /** Columns selected after writes on {@link tableName}; defaults to {@link selectColumns}. */
  protected get writeSelectColumns(): string {
    return this.selectColumns;
  }

  /** Maps rows returned from write operations; defaults to {@link mapRow}. */
  protected mapWriteRow(row: Record<string, unknown>): T {
    return this.mapRow(row);
  }

  protected get tableLabel(): string {
    return supabaseTableLabel(this.tableKey);
  }

  protected get tableName(): string {
    return SUPABASE_TABLES[this.tableKey].table;
  }

  /** Optional read-only source for list scans; writes still use {@link tableName}. */
  protected get listSourceTable(): string {
    return this.tableName;
  }

  protected get onConflict(): string {
    return SUPABASE_TABLES[this.tableKey].conflictColumn;
  }

  protected useSupabaseTransport(): boolean {
    return shouldUseSupabaseData(this.env, this.health);
  }

  protected silentTransport(): boolean {
    return this.bootstrapState.isWarming();
  }

  protected beginTransport(
    kind: 'read' | 'write' | 'rpc',
    message: string
  ): void {
    this.transportState.begin(kind, this.tableKey, message, {
      silent: this.silentTransport(),
    });
  }

  protected throwSupabaseError(error: {
    code?: string | null;
    message?: string | null;
    status?: number | null;
  }): never {
    if (isForbiddenSupabaseError(error)) {
      const now = Date.now();
      if (now - this.lastForbiddenAlertAt > 2_000) {
        this.lastForbiddenAlertAt = now;
        this.alertService.error('Access denied', ACCESS_DENIED_MESSAGE);
      }
    }
    throw new Error(error.message ?? 'Supabase request failed.');
  }

  protected mapRow(row: Record<string, unknown>): T {
    return toCamelCaseRecord<T>(row);
  }

  protected mapRows(rows: unknown[]): T[] {
    return rows.map(r => this.mapRow(r as Record<string, unknown>));
  }

  protected prepareRowForUpload(row: Record<string, unknown>): Record<string, unknown> {
    return sanitizeForUpload([row])[0];
  }

  protected prepareRowsForUpload(rows: T[]): Record<string, unknown>[] {
    return rows.map(row => this.prepareRowForUpload(row as Record<string, unknown>));
  }

  isListCacheReady(): boolean {
    return this.cacheManager.isCacheReady;
  }

  invalidateListCache(): void {
    this.cacheManager.invalidate();
  }

  async ensureListCache(pageSize = 1000): Promise<T[]> {
    if (this.useListCache && !this.cacheManager.isEnabled) {
      this.cacheManager = new ListCacheManager<T>(true);
    }

    await this.health.whenReady();

    if (!this.useSupabaseTransport()) {
      const local = this.loadLocalRows();
      if (this.useListCache) {
        this.cacheManager.setCache(local);
      }
      return local;
    }

    if (!this.useListCache) {
      return this.fetchAllFromSupabase(pageSize);
    }

    if (this.cacheManager.isCacheReady) {
      return this.cacheManager.getCache();
    }

    const rows = await this.fetchAllFromSupabase(pageSize);
    this.cacheManager.setCache(rows);
    return rows;
  }

  async fetchAll(pageSize = 1000): Promise<T[]> {
    return this.ensureListCache(pageSize);
  }

  /**
   * Paginated full scan with an optional date lower bound (PostgREST `.gte`).
   * Used by report modules to load YoY-scoped analytics without pulling full history.
   */
  protected async fetchAllSince(
    dateColumn: string,
    minValue: string,
    pageSize = 2000
  ): Promise<T[]> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      const field = this.toCamelField(dateColumn);
      const minTime = new Date(minValue).getTime();
      return this.loadLocalRows().filter(row => {
        const value = (row as Record<string, unknown>)[field];
        if (!value) return true;
        const time = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
        return Number.isFinite(time) && time >= minTime;
      });
    }
    return this.fetchAllFromSupabase(pageSize, query => query.gte(dateColumn, minValue));
  }

  async getPaginated(page = 1, limit = 20): Promise<IApiResponse<T[]>> {
    if (this.useListCache) {
      const all = await this.ensureListCache();
      return this.slicePage(all, page, limit);
    }

    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.slicePage(this.loadLocalRows(), page, limit);
    }

    this.beginTransport('read', `Loading ${this.tableLabel}…`);
    try {
      return await this.queryPaginated(page, limit);
    } finally {
      this.transportState.end();
    }
  }

  /** Paginated read with optional PostgREST filter chain (subclasses / report tables). */
  protected async queryPaginated(
    page = 1,
    limit = 20,
    applyListFilters?: (query: unknown) => unknown
  ): Promise<IApiResponse<T[]>> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.slicePage(this.loadLocalRows(), page, limit);
    }

    return this.getPaginatedFromSupabase(page, limit, applyListFilters);
  }

  async getById(id: string): Promise<T | null> {
    if (this.cacheManager.isCacheReady) {
      const hit = this.cacheManager.findMatch(id, (row, targetId) => this.matchesId(row, targetId));
      if (hit) return hit;
    }

    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.loadLocalRows().find(row => this.matchesId(row, id)) ?? null;
    }

    return this.getByIdFromSupabase(id);
  }

  async create(data: Partial<T>): Promise<T> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.createLocal(data);
    }

    this.beginTransport('write', `Saving ${this.tableLabel}…`);
    try {
      const payload = this.prepareRowForUpload(data as Record<string, unknown>);
      const client = this.supabase.getClient();
      if (!client) throw new Error('Supabase is not configured.');

      const { data: row, error } = await client
        .from(this.tableName)
        .insert(payload)
        .select(this.writeSelectColumns)
        .single();

      if (error) this.throwSupabaseError(error);
      const mapped = this.mapWriteRow(row as unknown as Record<string, unknown>);
      this.onListMutated('create', mapped);
      this.reportCache.invalidateReportForTable(this.tableKey);
      return mapped;
    } finally {
      this.transportState.end();
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.updateLocal(id, data);
    }

    this.beginTransport('write', `Updating ${this.tableLabel}…`);
    try {
      const payload = this.prepareRowForUpload(data as Record<string, unknown>);
      const client = this.supabase.getClient();
      if (!client) throw new Error('Supabase is not configured.');

      const { data: row, error } = await client
        .from(this.tableName)
        .update(payload)
        .eq(this.idColumn, id)
        .select(this.writeSelectColumns)
        .single();

      if (error) this.throwSupabaseError(error);
      const mapped = this.mapWriteRow(row as unknown as Record<string, unknown>);
      this.onListMutated('update', mapped);
      this.reportCache.invalidateReportForTable(this.tableKey);
      return mapped;
    } finally {
      this.transportState.end();
    }
  }

  async remove(id: string): Promise<void> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      this.removeLocal(id);
      return;
    }

    this.beginTransport('write', `Deleting ${this.tableLabel}…`);
    try {
      const client = this.supabase.getClient();
      if (!client) throw new Error('Supabase is not configured.');

      const { error } = await client.from(this.tableName).delete().eq(this.idColumn, id);
      if (error) this.throwSupabaseError(error);
      this.onListMutated('remove', id);
      this.reportCache.invalidateReportForTable(this.tableKey);
    } finally {
      this.transportState.end();
    }
  }

  async bulkUpload(data: T[]): Promise<IApiResponse<BulkUpsertResult>> {
    const sanitized = this.prepareRowsForUpload(data);

    if (!sanitized.length) {
      return {
        success: true,
        statusCode: 200,
        message: 'No rows to upload.',
        data: { total: 0, persisted: 0, batches: 0, errors: [] },
      };
    }

    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      return this.bulkUploadLocal(data);
    }

    this.beginTransport(
      'write',
      `Uploading ${sanitized.length.toLocaleString()} ${this.tableLabel}…`
    );
    try {
      return await this.bulkUploadSupabase(sanitized);
    } finally {
      this.transportState.end();
    }
  }

  private async bulkUploadSupabase(
    rows: Record<string, unknown>[]
  ): Promise<IApiResponse<BulkUpsertResult>> {
    const client = this.supabase.getClient();
    if (!client) {
      return {
        success: false,
        statusCode: 503,
        message: 'Supabase is not configured.',
        data: { total: 0, persisted: 0, batches: 0, errors: [] },
      };
    }

    const errors: { batch: number; message: string }[] = [];
    let persistedTotal = 0;
    let batchIndex = 0;
    const totalBatches = Math.ceil(rows.length / this.batchSize);

    for (let i = 0; i < rows.length; i += this.batchSize) {
      batchIndex++;
      this.transportState.updateProgress(
        batchIndex,
        totalBatches,
        `Uploading ${this.tableLabel} (batch ${batchIndex} of ${totalBatches})…`
      );

      const batch = rows.slice(i, i + this.batchSize);
      const { error, count } = await client.from(this.tableName).upsert(batch, {
        onConflict: this.onConflict,
        count: 'exact',
      });

      if (error) {
        errors.push({ batch: batchIndex, message: error.message });
        if (this.isAuthError(error.message)) break;
      } else {
        // count may be null when the driver cannot report it; treat null as 0.
        persistedTotal += count ?? 0;
      }
    }

    // Detect a silent RLS block: no PostgREST errors but zero rows actually persisted.
    // This happens when the user's role lacks the INSERT policy (e.g. a USER uploading
    // to a table whose WITH CHECK requires can_write_business_data()). PostgREST returns
    // 201 with no error, so without count verification the UI would falsely report success.
    if (errors.length === 0 && rows.length > 0 && persistedTotal === 0) {
      errors.push({
        batch: 0,
        message:
          'No rows were persisted — your role may lack write permission (RLS). Contact an administrator.',
      });
    }

    this.onListMutated('bulk');
    this.reportCache.invalidateReportForTable(this.tableKey);

    return {
      success: errors.length === 0,
      statusCode: errors.length ? 207 : 200,
      message: errors.length ? 'Bulk upsert completed with errors.' : 'Bulk upsert completed.',
      data: {
        total: rows.length,
        persisted: persistedTotal,
        batches: batchIndex,
        errors,
      },
    };
  }

  private isAuthError(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('jwt') || lower.includes('permission') || lower.includes('401');
  }

  private async fetchAllFromSupabase(
    pageSize: number,
    applyFilter?: (query: {
      gte: (column: string, value: string) => unknown;
    }) => unknown
  ): Promise<T[]> {
    const client = this.supabase.getClient();
    if (!client) return [];

    const batchSize = Math.min(Math.max(pageSize, 1), POSTGREST_MAX_PAGE_SIZE);

    this.beginTransport('read', `Loading ${this.tableLabel}…`);
    try {
      const rows: T[] = [];
      let from = 0;
      let totalCount: number | null = null;

      while (true) {
        const to = from + batchSize - 1;
        let query = client
          .from(this.listSourceTable)
          .select(this.selectColumns, from === 0 ? { count: 'exact' } : undefined);

        query = this.applyOrderToQuery(query);
        query = query.range(from, to);

        if (applyFilter) {
          query = applyFilter(query) as typeof query;
        }

        const { data, error, count } = await query;

        if (error) break;
        if (!data?.length) break;

        if (from === 0 && count !== null) {
          totalCount = count;
        }

        rows.push(...this.mapRows(data));

        if (totalCount !== null && totalCount > 0) {
          this.transportState.updateProgress(
            rows.length,
            totalCount,
            `Loading ${this.tableLabel} (${rows.length.toLocaleString()} of ${totalCount.toLocaleString()})…`
          );
        }

        from += data.length;

        if (totalCount !== null && rows.length >= totalCount) break;
        if (totalCount === null && data.length < batchSize) break;
      }

      return rows;
    } finally {
      this.transportState.end();
    }
  }

  private async getPaginatedFromSupabase(
    page: number,
    limit: number,
    applyListFilters?: (query: unknown) => unknown
  ): Promise<IApiResponse<T[]>> {
    const client = this.supabase.getClient();
    if (!client) return this.emptyPage(page, limit);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = client
      .from(this.listSourceTable)
      .select(this.selectColumns, { count: 'exact' });

    if (applyListFilters) {
      query = applyListFilters(query) as typeof query;
    }

    query = this.applyOrderToQuery(query);
    const { data, error, count } = await query.range(from, to);

    if (error) {
      return {
        success: false,
        statusCode: 500,
        message: error.message,
        data: [],
        meta: this.buildMeta(0, page, limit),
      };
    }

    const mapped = data ? this.mapRows(data) : [];
    const totalItems = count ?? mapped.length;

    return {
      success: true,
      statusCode: 200,
      message: 'OK',
      data: mapped,
      meta: this.buildMeta(totalItems, page, limit),
    };
  }

  private async getByIdFromSupabase(id: string): Promise<T | null> {
    const client = this.supabase.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from(this.tableName)
      .select(this.selectColumns)
      .eq(this.idColumn, id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRow(data as unknown as Record<string, unknown>);
  }

  private matchesId(row: T, id: string): boolean {
    const record = row as { id?: string; control?: string };
    return record.id === id || record.control === id;
  }

  private buildMeta(totalItems: number, page: number, limit: number) {
    return {
      totalItems,
      currentPage: page,
      itemsPerPage: limit,
      totalPages: Math.ceil(totalItems / limit) || 1,
    };
  }

  private emptyPage(page: number, limit: number): IApiResponse<T[]> {
    return {
      success: true,
      statusCode: 200,
      message: 'OK',
      data: [],
      meta: this.buildMeta(0, page, limit),
    };
  }

  /**
   * Applies {@link orderColumn} (desc) plus optional {@link orderTiebreaker} so
   * pagination stays stable when many rows share the same primary sort value.
   */
  private applyOrderToQuery<Q extends {
    order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => Q;
  }>(query: Q): Q {
    let ordered = query.order(this.orderColumn, { ascending: false, nullsFirst: false });
    if (this.orderTiebreaker && this.orderTiebreaker !== this.orderColumn) {
      ordered = ordered.order(this.orderTiebreaker, { ascending: false });
    }
    return ordered;
  }

  private slicePage(all: T[], page: number, limit: number): IApiResponse<T[]> {
    const totalItems = all.length;
    const from = (page - 1) * limit;
    const data = all.slice(from, from + limit);

    return {
      success: true,
      statusCode: 200,
      message: 'OK',
      data,
      meta: this.buildMeta(totalItems, page, limit),
    };
  }

  private onListMutated(action: 'create' | 'update' | 'remove' | 'bulk', payload?: T | string): void {
    if (!this.useListCache) return;

    const needsRefresh = this.cacheManager.onMutated(action, payload, (row, id) => this.matchesId(row, id));
    
    if (needsRefresh) {
      void this.refreshListCache();
    }
  }

  private async refreshListCache(): Promise<void> {
    this.cacheManager.invalidate();
    await this.ensureListCache();
  }

  private loadLocalRows(): T[] {
    return LocalStorageEntityStore.load<T>(this.tableKey);
  }

  private persistLocalRows(rows: T[]): void {
    LocalStorageEntityStore.save(this.tableKey, rows);
  }

  private toCamelField(column: string): string {
    return column.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  }

  private createLocal(data: Partial<T>): T {
    const id = (data as { id?: string }).id || crypto.randomUUID();
    const mapped = { ...(data as object), id, isLocal: false } as T;
    const rows = this.loadLocalRows();
    rows.unshift(mapped);
    this.persistLocalRows(rows);
    this.onListMutated('create', mapped);
    this.reportCache.invalidateReportForTable(this.tableKey);
    return mapped;
  }

  private updateLocal(id: string, data: Partial<T>): T {
    const rows = this.loadLocalRows();
    const index = rows.findIndex(row => this.matchesId(row, id));
    if (index < 0) {
      throw new Error(`${this.tableLabel} record not found.`);
    }
    const mapped = { ...rows[index], ...data, id } as T;
    rows[index] = mapped;
    this.persistLocalRows(rows);
    this.onListMutated('update', mapped);
    this.reportCache.invalidateReportForTable(this.tableKey);
    return mapped;
  }

  private removeLocal(id: string): void {
    const rows = this.loadLocalRows().filter(row => !this.matchesId(row, id));
    this.persistLocalRows(rows);
    this.onListMutated('remove', id);
    this.reportCache.invalidateReportForTable(this.tableKey);
  }

  private bulkUploadLocal(data: T[]): IApiResponse<BulkUpsertResult> {
    const incoming = data.map(row => {
      const id = (row as { id?: string }).id || crypto.randomUUID();
      return { ...row, id, isLocal: false } as T;
    });
    const existing = this.loadLocalRows();

    for (const row of incoming) {
      const id = (row as { id: string }).id;
      const index = existing.findIndex(item => this.matchesId(item, id));
      if (index >= 0) {
        existing[index] = { ...existing[index], ...row } as T;
      } else {
        existing.unshift(row);
      }
    }

    this.persistLocalRows(existing);
    this.onListMutated('bulk');
    this.reportCache.invalidateReportForTable(this.tableKey);

    return {
      success: true,
      statusCode: 200,
      message: 'Saved to local demo storage.',
      data: {
        total: incoming.length,
        persisted: incoming.length,
        batches: 1,
        errors: [],
      },
    };
  }
}
