import { ISaleRecordView } from '@core/interfaces/ISaleRecordDto.interface';
import { toISOWeek } from '@core/auxiliar/sales-audit.utils';
import { DateUtils } from './date.utils';

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
