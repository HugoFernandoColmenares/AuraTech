import { computeScopedYearComparison, formatYtdComparisonPeriodLabel } from './sales.util';
import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';

const EMPTY_FILTERS: SalesFilters = {
  search: '',
  account: [],
  startDate: null,
  endDate: null,
};

function sale(
  year: number,
  month: number,
  total: number,
  qty = 1
): ISaleRecordDto {
  return {
    id: `${year}-${month}`,
    orderId: `${year}-${month}`,
    idx: 0,
    orderStatus: '',
    warehouseCode: 'GEN',
    account: 'Retail',
    channel: 'Retail',
    category: 'Retail',
    orderPlaceDate: new Date(Date.UTC(year, month - 1, 1)),
    sku: 'SKU',
    itemCost: 0,
    itemQuantity: qty,
    total,
    auditYear: year,
    auditMonth: month,
    isLocal: false,
  };
}

describe('computeScopedYearComparison (YTD)', () => {
  const records: ISaleRecordDto[] = [
    sale(2026, 1, 100),
    sale(2026, 5, 200),
    sale(2025, 1, 50),
    sale(2025, 5, 80),
    sale(2025, 12, 1000),
  ];

  it('compares Jan through latest month vs same months in prior year', () => {
    const result = computeScopedYearComparison(records, EMPTY_FILTERS, r => r.total);

    expect(result.currentYear).toBe(2026);
    expect(result.compareYear).toBe(2025);
    expect(result.currentMonth).toBe(5);
    expect(result.currentTotal).toBe(300);
    expect(result.compareTotal).toBe(130);
    expect(result.status).toBe('complete');
  });

  it('extends the window when a later month is uploaded', () => {
    const withJune = [...records, sale(2026, 6, 150), sale(2025, 6, 70)];

    const result = computeScopedYearComparison(withJune, EMPTY_FILTERS, r => r.total);

    expect(result.currentMonth).toBe(6);
    expect(result.currentTotal).toBe(450);
    expect(result.compareTotal).toBe(200);
  });
});

describe('formatYtdComparisonPeriodLabel', () => {
  it('formats a multi-month YTD label', () => {
    expect(formatYtdComparisonPeriodLabel(2026, 2025, 5)).toBe(
      'Jan – May 2026 vs Jan – May 2025'
    );
  });
});
