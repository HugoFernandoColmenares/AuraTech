import { AlertService } from '@core/services/Utils/alert.service';

/** Confirms and deletes records one-by-one; returns true when at least one row was removed. */
export async function confirmAndRemoveBatch<T extends { id: string }>(options: {
  rows: T[];
  alertService: AlertService;
  confirmTitle: string;
  confirmMessage: (count: number) => string;
  remove: (id: string) => Promise<void>;
  successMessage: (deletedRows: T[]) => string;
  partialErrorMessage?: (failed: number) => string;
}): Promise<boolean> {
  const { rows, alertService } = options;
  if (!rows.length) return false;

  const result = await alertService.confirm(
    options.confirmTitle,
    options.confirmMessage(rows.length)
  );
  if (!result.isConfirmed) return false;

  const deletedRows: T[] = [];
  let failed = 0;
  for (const row of rows) {
    try {
      await options.remove(row.id);
      deletedRows.push(row);
    } catch {
      failed++;
    }
  }

  if (deletedRows.length > 0) {
    alertService.success('Deleted', options.successMessage(deletedRows));
  }
  if (failed > 0) {
    alertService.warning(
      'Partial failure',
      options.partialErrorMessage?.(failed) ?? `${failed} record(s) could not be deleted.`
    );
  }

  return deletedRows.length > 0;
}
