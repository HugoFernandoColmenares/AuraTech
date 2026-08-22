import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import {
  auditYmFromFilterDate,
  getEffectiveAuditYm,
  getNormalizedAuditMonth,
} from '@core/auxiliar/sales-audit.utils';

/** Applies coordinator filter state to a sales record collection. */
export function filterSaleRecords(
  data: ISaleRecordDto[],
  filters: SalesFilters
): ISaleRecordDto[] {
  let rows = data;
  const { search, account, startDate, endDate, months } = filters;

  if (account?.length) {
    rows = rows.filter(r => account.includes(r.account || ''));
  }

  if (search) {
    const query = search.toLowerCase();
    rows = rows.filter(
      r =>
        r.sku.toLowerCase().includes(query) ||
        r.warehouseCode.toLowerCase().includes(query) ||
        (r.account && r.account.toLowerCase().includes(query))
    );
  }

  const startYm = auditYmFromFilterDate(startDate);
  if (startYm != null) {
    rows = rows.filter(r => getEffectiveAuditYm(r) >= startYm);
  }

  const endYm = auditYmFromFilterDate(endDate);
  if (endYm != null) {
    rows = rows.filter(r => getEffectiveAuditYm(r) <= endYm);
  }

  if (months?.length) {
    rows = rows.filter(r => months.includes(getNormalizedAuditMonth(r)));
  }

  return rows;
}
