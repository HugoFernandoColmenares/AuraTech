import { Injectable, inject } from '@angular/core';
import { AlertService } from './alert.service';
import { IApiResponse } from '@core/interfaces/IApiResponse.interface';
import type { BulkUpsertResult } from '@core/interfaces/IBulkUpsertResult.interface';

export interface BulkSyncOptions<T extends { isLocal?: boolean }> {
  records: T[];
  upload: (rows: T[]) => Promise<IApiResponse<unknown>>;
  entityLabel?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Optional custom success copy; receives the number of rows actually uploaded. */
  successMessage?: string | ((uploaded: number) => string);
  onSuccess?: () => void | Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class BulkSyncService {
  private alertService = inject(AlertService);

  async exportLocalRecords<T extends { isLocal?: boolean }>(
    options: BulkSyncOptions<T>
  ): Promise<boolean> {
    const label = options.entityLabel ?? 'records';
    const newData = options.records;

    if (!newData.length) {
      this.alertService.info(
        options.emptyTitle ?? 'No New Data',
        options.emptyMessage ?? `There are no new ${label} to export.`
      );
      return false;
    }

    try {
      const res = await options.upload(newData);
      const outcome = this.resolveUploadOutcome(res, newData.length);

      if (!outcome.ok) {
        throw new Error(outcome.message);
      }

      const successText =
        typeof options.successMessage === 'function'
          ? options.successMessage(outcome.uploaded)
          : options.successMessage ??
            outcome.message ??
            `${outcome.uploaded} ${label} imported successfully.`;

      this.alertService.success('Export Success', successText);
      await options.onSuccess?.();
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Failed to export ${label} to the database.`;
      console.error(`[BulkSyncService] Export failed (${label}):`, err);
      this.alertService.error('Export Error', message);
      return false;
    }
  }

  private resolveUploadOutcome(
    res: IApiResponse<unknown>,
    attempted: number
  ): { ok: boolean; uploaded: number; message: string } {
    const payload = res.data as BulkUpsertResult | undefined;
    const errors = payload?.errors ?? [];
    const failedBatches = errors.length;
    // Prefer the server-reported persisted count (count: 'exact'); fall back to the
    // previous total-minus-failures heuristic for callers that don't populate it yet.
    const uploaded =
      payload?.persisted ?? Math.max(0, (payload?.total ?? attempted) - failedBatches);

    if (!res.success && res.statusCode !== 200 && res.statusCode !== 201) {
      const detail = errors[0]?.message ?? res.message ?? 'Import failed.';
      return { ok: false, uploaded: 0, message: detail };
    }

    if (uploaded <= 0) {
      const detail =
        errors[0]?.message ??
        res.message ??
        'No rows were persisted to the database.';
      return { ok: false, uploaded: 0, message: detail };
    }

    if (failedBatches > 0) {
      return {
        ok: false,
        uploaded,
        message: `Exported ${uploaded} rows, but ${failedBatches} batch(es) failed. ${errors[0]?.message ?? ''}`.trim(),
      };
    }

    return {
      ok: true,
      uploaded,
      message: res.message || `${uploaded} rows imported successfully.`,
    };
  }
}
