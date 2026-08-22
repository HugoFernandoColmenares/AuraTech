import { PivotRow, PivotYearData } from '@core/interfaces/pivot.interface';

export interface BuildYoyPivotOptions<T> {
  records: T[];
  getYear: (record: T) => number | null;
  getMonth: (record: T) => number | null;
  getLabel: (record: T) => string;
  getValue: (record: T) => number;
  /** When set, row.total and yearTotal sum only these month indices (0–11). */
  selectedMonthIndices?: number[];
}

const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Builds year → label → monthly values for pivot / YoY tables. */
export function buildYoyPivotData<T>(options: BuildYoyPivotOptions<T>): PivotYearData[] {
  const { records, getYear, getMonth, getLabel, getValue, selectedMonthIndices } = options;
  const monthFilter = selectedMonthIndices ?? ALL_MONTHS;
  const yearsMap = new Map<number, Map<string, number[]>>();

  for (const record of records) {
    const year = getYear(record);
    const month = getMonth(record);
    if (year == null || month == null || month < 0 || month > 11) continue;

    const label = getLabel(record);
    const value = getValue(record);

    if (!yearsMap.has(year)) yearsMap.set(year, new Map());
    const labelMap = yearsMap.get(year)!;
    if (!labelMap.has(label)) labelMap.set(label, new Array(12).fill(0));
    labelMap.get(label)![month] += value;
  }

  const result: PivotYearData[] = [];

  for (const year of Array.from(yearsMap.keys()).sort((a, b) => b - a)) {
    const labelMap = yearsMap.get(year)!;
    const rows: PivotRow[] = [];
    const monthsTotal = new Array(12).fill(0);
    let yearTotal = 0;

    for (const label of labelMap.keys()) {
      const months = labelMap.get(label)!;
      let total = 0;
      for (let i = 0; i < 12; i++) {
        if (monthFilter.includes(i)) total += months[i];
        monthsTotal[i] += months[i];
      }
      yearTotal += total;
      rows.push({ label, months, total });
    }

    rows.sort((a, b) => b.total - a.total);
    result.push({ year, rows, monthsTotal, yearTotal });
  }

  return result;
}
