import { ISaleRecordView } from '@core/interfaces/ISaleRecordDto.interface';
import { PivotRow, PivotYearData } from '@core/interfaces/pivot.interface';
import { toISOWeek } from '@core/auxiliar/sales.util';
import { DateUtils } from '@core/auxiliar/date.utils';

export function getProductGroupingKey(
  r: ISaleRecordView,
  grouping: string,
  showStyleName = false
): string {
  const productLabel =
    showStyleName && r.styleName?.trim() ? r.styleName.trim() : r.parent || r.sku || 'Unknown';

  const keyMap: Record<string, string> = {
    sku: r.sku,
    parent: productLabel,
    products: productLabel,
    brand: r.brand || 'Unknown',
    collection: r.collection || 'None',
    account: r.account || 'Unknown',
    category: r.category || 'Unknown',
    type: r.brand || 'Unknown',
    division: r.category || 'Unknown',
  };

  return keyMap[grouping] || r.sku;
}

export function getTimePeriodKey(date: Date, granularity: string, shiftYear = false): string {
  const d = DateUtils.parseDate(date);
  if (!d) return 'Jan';
  if (shiftYear) d.setFullYear(d.getFullYear() + 1);

  if (granularity === 'week') return toISOWeek(d);
  if (granularity === 'year') return String(d.getFullYear());

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function groupAndSum<T>(
  data: T[],
  keyFn: (item: T) => string,
  valFn: (item: T) => number
): { key: string; total: number }[] {
  const map = new Map<string, number>();
  data.forEach(item => {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + valFn(item));
  });

  return Array.from(map.entries()).map(([key, total]) => ({ key, total }));
}

export function comparePeriods<T>(
  currentData: T[],
  lyData: T[],
  keyFn: (item: T) => string,
  valFn: (item: T) => number
) {
  const mapCurr = new Map<string, number>();
  const mapLY = new Map<string, number>();

  currentData.forEach(item => mapCurr.set(keyFn(item), (mapCurr.get(keyFn(item)) ?? 0) + valFn(item)));
  lyData.forEach(item => mapLY.set(keyFn(item), (mapLY.get(keyFn(item)) ?? 0) + valFn(item)));

  const allKeys = Array.from(new Set([...mapCurr.keys(), ...mapLY.keys()]));

  return allKeys.map(name => {
    const currentVal = mapCurr.get(name) ?? 0;
    const lyVal = mapLY.get(name) ?? 0;
    const diff = currentVal - lyVal;
    const pct = lyVal === 0 ? 0 : Number(((diff / lyVal) * 100).toFixed(2));
    return { name, current: currentVal, ly: lyVal, diff, pct };
  }).sort((a, b) => b.current - a.current);
}

export interface BuildYoyPivotOptions<T> {
  records: T[];
  getYear: (record: T) => number | null;
  getMonth: (record: T) => number | null;
  getLabel: (record: T) => string;
  getValue: (record: T) => number;
  selectedMonthIndices?: number[];
}

const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
