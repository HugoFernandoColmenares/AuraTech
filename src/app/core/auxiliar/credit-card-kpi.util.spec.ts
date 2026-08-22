import { computeYearSpendComparison, formatYearSpendPeriodLabel } from './credit-card-kpi.util';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';

function tx(year: number, monthIndex: number, amount: number): ICreditCardTransactionDto {
  return {
    id: `${year}-${monthIndex}`,
    date: new Date(Date.UTC(year, monthIndex, 1)),
    receipt: null,
    description: 'Test',
    cardMember: '',
    accountNumberSuffix: '',
    channel: 'Online',
    dept: '',
    amount,
    extendedDetails: '',
    statementDescription: '',
    address: '',
    cityState: '',
    zipCode: '',
    country: '',
    referenceNumber: '',
    category: 'Travel',
    auditYear: year,
    auditMonth: monthIndex + 1,
  };
}

describe('computeYearSpendComparison (YTD)', () => {
  const records: ICreditCardTransactionDto[] = [
    tx(2026, 0, 100),
    tx(2026, 4, 200),
    tx(2025, 0, 40),
    tx(2025, 4, 60),
    tx(2025, 11, 900),
  ];

  it('compares Jan through latest statement month vs same months in prior year', () => {
    const result = computeYearSpendComparison(records, records, 2026, false);

    expect(result.currentYear).toBe(2026);
    expect(result.compareYear).toBe(2025);
    expect(result.currentMonth).toBe(5);
    expect(result.currentTotal).toBe(300);
    expect(result.compareTotal).toBe(100);
    expect(result.status).toBe('complete');
  });
});

describe('formatYearSpendPeriodLabel', () => {
  it('delegates to the shared YTD label formatter', () => {
    expect(formatYearSpendPeriodLabel(2026, 2025, 5)).toBe(
      'Jan – May 2026 vs Jan – May 2025'
    );
  });
});
