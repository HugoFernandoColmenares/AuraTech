const CAMEL_TO_SNAKE = /[A-Z]/g;

export function camelToSnake(key: string): string {
  return key.replace(CAMEL_TO_SNAKE, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function toSnakeCaseRecord<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'isLocal') continue;
    out[camelToSnake(key)] = serializeValue(value);
  }
  return out;
}

export function toCamelCaseRecord<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = deserializeValue(value);
  }
  return out as T;
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function deserializeValue(value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

/** Strip frontend-only properties before persistence. */
export function sanitizeForUpload<T extends Record<string, unknown>>(
  rows: T[]
): Record<string, unknown>[] {
  return rows.map(row => {
    const { isLocal, ...rest } = row;
    return toSnakeCaseRecord(rest as Record<string, unknown>);
  });
}
