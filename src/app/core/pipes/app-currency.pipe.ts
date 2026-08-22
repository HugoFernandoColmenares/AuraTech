import { Pipe, PipeTransform } from '@angular/core';

/**
 * Standard USD currency display for pivot tables, KPIs, and analytics.
 * Use instead of ad-hoc number/currency formatting across features.
 */
@Pipe({
  name: 'appCurrency',
  standalone: true,
})
export class AppCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, digitsInfo = '1.2-2'): string {
    if (value == null || isNaN(Number(value))) return '';

    const parts = digitsInfo.split('-');
    const minFrac = parts.length > 1 ? Number(parts[1]) : 2;
    const maxFrac = parts.length > 2 ? Number(parts[2]) : minFrac;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    }).format(Number(value));
  }
}
