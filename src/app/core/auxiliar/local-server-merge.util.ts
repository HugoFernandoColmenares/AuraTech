/**
 * Merges pending local session rows with historical server rows.
 *
 * Local rows take precedence on business-key collisions (they reflect the
 * freshest user edits / uploads not yet persisted). Server rows fill in the
 * rest of the history. The result is de-duplicated by the caller-provided key
 * extractor so the table/analytics show the full picture instead of only the
 * local session.
 *
 * Used by the sales, inventory and credit-card coordinators to fix the
 * "table only shows isLocal rows" bug.
 */
export function mergeLocalAndServer<T>(
  local: readonly T[],
  server: readonly T[],
  keyFn: (row: T) => string
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const row of local) {
    const key = keyFn(row);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(row);
    }
  }

  for (const row of server) {
    const key = keyFn(row);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(row);
    }
  }

  return merged;
}
