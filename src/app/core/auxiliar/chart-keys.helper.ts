import { ISaleRecordView } from '@core/interfaces/ISaleRecordDto.interface';
import { toISOWeek } from '@core/auxiliar/sales-audit.utils';
import { DateUtils } from './date.utils';

export function getProductGroupingKey(r: ISaleRecordView, grouping: string, refData: any[], showStyleName: boolean): string {
  if (r.sku.toLowerCase().includes('x-redo')) return 'Unknown';
  
  const parts = r.sku.split('-');
  const parent = parts[0] || 'Unknown';
  const color = parts[1] || '';
  const size = parts[2] || '';
  
  const found = refData.find((item: any) => item.parent === parent);
  const styleName = (showStyleName && found) ? found.styleName : parent;

  const keyMap: Record<string, string> = {
    'sku': r.sku,
    'parent': styleName,
    'brand': r.brand || 'Unknown',
    'collection': r.collection || 'None',
    'account': r.account || 'Unknown',
    'type': found?.type || 'Unknown',
    'division': found?.div || 'Unknown',
    'parent-color': color ? `${styleName} - ${color}` : styleName,
    'parent-size': size ? `${styleName} - ${size}` : styleName,
    'brand-color': color ? `${r.brand || 'Unknown'} - ${color}` : r.brand || 'Unknown',
    'brand-size': size ? `${r.brand || 'Unknown'} - ${size}` : r.brand || 'Unknown',
    'collection-color': color ? `${r.collection || 'None'} - ${color}` : r.collection || 'None',
    'collection-size': size ? `${r.collection || 'None'} - ${size}` : r.collection || 'None',
  };
  
  return keyMap[grouping] || r.sku;
}

export function getTimePeriodKey(date: Date, granularity: string, shiftYear = false): string {
  const d = DateUtils.parseDate(date);
  if (!d) return 'Jan';
  if (shiftYear) d.setFullYear(d.getFullYear() + 1);
  
  if (granularity === 'week') return toISOWeek(d);
  if (granularity === 'year') return String(d.getFullYear());
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}