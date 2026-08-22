import { SupabaseTableKey } from '@core/constants/supabase-tables.const';
import { buildDemoProducts, buildDemoSaleRecords } from '@core/data/demo-seed.data';

const STORAGE_PREFIX = 'auratech.ls.';
const SEED_FLAG = 'auratech.ls.seeded.v2';

function reviveDates<T extends object>(row: T): T {
  const record = row as T & { orderPlaceDate?: string | Date | null; createdAt?: string | Date; updatedAt?: string | Date };
  if (record.orderPlaceDate) {
    record.orderPlaceDate = new Date(record.orderPlaceDate);
  }
  if (record.createdAt) {
    record.createdAt = new Date(record.createdAt);
  }
  if (record.updatedAt) {
    record.updatedAt = new Date(record.updatedAt);
  }
  return record;
}

/** Browser persistence for demo mode. Supabase services stay in place for live deployments. */
export class LocalStorageEntityStore {
  static ensureSeeded(): void {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(SEED_FLAG) === '1') return;

    this.save('saleRecords', buildDemoSaleRecords());
    this.save('products', buildDemoProducts());
    localStorage.setItem(SEED_FLAG, '1');
  }

  static load<T extends object>(tableKey: SupabaseTableKey): T[] {
    this.ensureSeeded();
    const raw = localStorage.getItem(STORAGE_PREFIX + tableKey);
    if (!raw) return [];
    try {
      return (JSON.parse(raw) as T[]).map(row => reviveDates(row));
    } catch {
      return [];
    }
  }

  static save<T>(tableKey: SupabaseTableKey, rows: T[]): void {
    localStorage.setItem(STORAGE_PREFIX + tableKey, JSON.stringify(rows));
  }
}
