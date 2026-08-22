import { SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { DateUtils } from '@core/auxiliar/date.utils';
import { auditYmFromFilterDate } from '@core/auxiliar/sales-audit.utils';

/** True when the sales table should query Supabase with filter predicates (not client-only). */
export function hasActiveSalesTableFilters(filters: SalesFilters): boolean {
  const months = filters.months ?? [];
  const allMonthsSelected = months.length === 12;

  return !!(
    filters.search?.trim() ||
    filters.account?.length ||
    filters.startDate ||
    filters.endDate ||
    (months.length > 0 && !allMonthsSelected)
  );
}

/** Stable cache key for filtered paginated GET responses. */
export function salesTableFiltersCacheKey(filters: SalesFilters): string {
  return JSON.stringify({
    account: filters.account ?? [],
    search: filters.search?.trim() ?? '',
    start: filters.startDate ? DateUtils.formatUtcDateString(filters.startDate) : '',
    end: filters.endDate ? DateUtils.formatUtcDateString(filters.endDate) : '',
    months: filters.months ?? [],
  });
}

type SalesTableQuery = {
  in: (column: string, values: unknown[]) => SalesTableQuery;
  or: (filters: string) => SalesTableQuery;
  gte: (column: string, value: number) => SalesTableQuery;
  lte: (column: string, value: number) => SalesTableQuery;
};

/**
 * Applies coordinator filter state to a PostgREST query on curated sales list data.
 * Table reads use `sale_records_analytics` (MV): month column is `am`, bounds use `audit_ym`.
 */
export function applySalesTableFiltersToQuery<Q>(query: Q, filters: SalesFilters): Q {
  let q = query as SalesTableQuery;

  if (filters.account?.length) {
    q = q.in('account', filters.account);
  }

  const search = filters.search?.trim();
  if (search) {
    const term = `%${search}%`;
    q = q.or(`sku.ilike.${term},warehouse_code.ilike.${term},account.ilike.${term}`);
  }

  const months = filters.months ?? [];
  if (months.length > 0 && months.length < 12) {
    q = q.in('am', months.map(m => m + 1));
  }

  const startYm = auditYmFromFilterDate(filters.startDate);
  if (startYm != null) {
    q = q.gte('audit_ym', startYm);
  }

  const endYm = auditYmFromFilterDate(filters.endDate);
  if (endYm != null) {
    q = q.lte('audit_ym', endYm);
  }

  return q as Q;
}
