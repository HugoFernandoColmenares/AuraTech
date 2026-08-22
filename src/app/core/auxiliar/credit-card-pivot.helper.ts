import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';
import { resolveControlCategory } from '@core/data/control-channel-mapsheet';
import { mapCreditCardChannel } from '@core/pipes/credit-card-channel-display.pipe';
import { getCreditCardMonth, getCreditCardYear } from '@core/auxiliar/credit-card-date.util';

export interface CreditCardPivotSubRow {
  label: string;
  months: number[];
  total: number;
}

export interface CreditCardPivotCategoryRow {
  label: string;
  months: number[];
  total: number;
  subRows: CreditCardPivotSubRow[];
}

export interface CreditCardPivotYearBlock {
  year: number;
  categories: CreditCardPivotCategoryRow[];
  monthsTotal: number[];
  yearTotal: number;
}

interface ChannelBucket {
  months: number[];
}

function emptyMonths(): number[] {
  return new Array(12).fill(0);
}

function addAmount(bucket: ChannelBucket, month: number, amount: number): void {
  if (month < 0 || month > 11) return;
  bucket.months[month] += amount;
}

function sumMonths(months: number[]): number {
  return months.reduce((acc, value) => acc + value, 0);
}

/** Builds Excel-style category → channel pivot blocks for credit card spend. */
export function buildCreditCardSpendPivot(options: {
  records: ICreditCardTransactionDto[];
  selectedYears: number[];
  selectedMonthIndices?: number[];
}): CreditCardPivotYearBlock[] {
  const { records, selectedYears } = options;
  const monthFilter = options.selectedMonthIndices ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const yearSet = new Set(selectedYears);

  const yearMap = new Map<number, Map<string, Map<string, ChannelBucket>>>();

  for (const record of records) {
    const year = getCreditCardYear(record);
    if (!yearSet.has(year)) continue;

    const month = getCreditCardMonth(record);
    const category = resolveControlCategory(record.control, record.category || 'Uncategorized');
    const channel = mapCreditCardChannel(record.channel || record.salesChannel);

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const categoryMap = yearMap.get(year)!;
    if (!categoryMap.has(category)) categoryMap.set(category, new Map());
    const channelMap = categoryMap.get(category)!;
    if (!channelMap.has(channel)) channelMap.set(channel, { months: emptyMonths() });

    addAmount(channelMap.get(channel)!, month, record.amount);
  }

  return Array.from(yearMap.keys())
    .sort((a, b) => b - a)
    .map(year => {
      const categoryMap = yearMap.get(year)!;
      const monthsTotal = emptyMonths();
      let yearTotal = 0;

      const categories: CreditCardPivotCategoryRow[] = Array.from(categoryMap.entries())
        .map(([label, channelMap]) => {
          const categoryMonths = emptyMonths();
          const subRows: CreditCardPivotSubRow[] = [];

          for (const [channelLabel, bucket] of channelMap.entries()) {
            const subMonths = [...bucket.months];
            const subTotal = sumMonths(
              subMonths.map((value, index) => (monthFilter.includes(index) ? value : 0))
            );

            subRows.push({ label: channelLabel, months: subMonths, total: subTotal });

            subMonths.forEach((value, index) => {
              categoryMonths[index] += value;
            });
          }

          subRows.sort((a, b) => b.total - a.total);

          const total = sumMonths(
            categoryMonths.map((value, index) => (monthFilter.includes(index) ? value : 0))
          );

          categoryMonths.forEach((value, index) => {
            monthsTotal[index] += value;
          });
          yearTotal += total;

          return { label, months: categoryMonths, total, subRows };
        })
        .sort((a, b) => b.total - a.total);

      return { year, categories, monthsTotal, yearTotal };
    });
}
