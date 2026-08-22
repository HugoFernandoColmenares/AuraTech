export interface BulkUpsertResult {
  /** Number of rows attempted across all batches. */
  total: number;
  /** Number of rows actually persisted (PostgREST `count: 'exact'`). */
  persisted: number;
  batches: number;
  errors: { batch: number; message: string }[];
}
