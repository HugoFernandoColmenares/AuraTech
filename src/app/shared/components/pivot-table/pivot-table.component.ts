import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PivotYearData, PivotTrend, PivotRow } from '@core/interfaces/pivot.interface';
import { TrendHighlightPipe } from '@core/pipes/trend-highlight.pipe';
import { ChannelDisplayPipe } from '@core/pipes/channel-display.pipe';
import { AppCurrencyPipe } from '@core/pipes/app-currency.pipe';

export type PivotLabelFormat = 'plain' | 'account';
export type PivotValueType = 'number' | 'currency';

@Component({
  selector: 'app-pivot-table',
  standalone: true,
  imports: [CommonModule, TrendHighlightPipe, ChannelDisplayPipe, AppCurrencyPipe],
  templateUrl: './pivot-table.component.html',
  styleUrl: './pivot-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PivotTableComponent {
  data = input.required<PivotYearData[]>();
  months = input.required<readonly { value: number; label: string }[]>();
  selectedMonths = input<number[]>([]);
  showTotal = input(true);
  showTrend = input(false);
  /** @deprecated Prefer valueType="currency" for monetary columns */
  format = input('1.0-0');
  /** How to render row labels — `account` applies ChannelDisplayPipe */
  labelFormat = input<PivotLabelFormat>('plain');
  /** number = quantity/count; currency = USD via AppCurrencyPipe */
  valueType = input<PivotValueType>('number');
  currencyDigits = input('1.2-2');
  grandTotals = input<{ monthsTotal: number[]; grandTotal: number } | null>(null);
  /** Enables clickable column headers with internal row sorting */
  sortable = input(true);

  sortKey = signal('total');
  sortDir = signal<'asc' | 'desc'>('desc');
  collapsedYears = signal<Set<number>>(new Set());

  sortedData = computed(() => {
    const data = this.data();
    if (!this.sortable()) return data;

    const key = this.sortKey();
    const factor = this.sortDir() === 'asc' ? 1 : -1;

    return data.map(yearBlock => ({
      ...yearBlock,
      rows: [...yearBlock.rows].sort((a: PivotRow, b: PivotRow) => {
        if (key === 'label') {
          return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) * factor;
        }
        if (key === 'total') {
          return (a.total - b.total) * factor;
        }
        if (key.startsWith('month-')) {
          const idx = Number(key.replace('month-', ''));
          return ((a.months[idx] ?? 0) - (b.months[idx] ?? 0)) * factor;
        }
        return 0;
      }),
    }));
  });

  toggleSort(key: string): void {
    if (!this.sortable()) return;

    if (this.sortKey() === key) {
      this.sortDir.update(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'label' ? 'asc' : 'desc');
    }
  }

  isSorted(key: string): boolean {
    return this.sortKey() === key;
  }

  sortIcon(key: string): string {
    if (!this.isSorted(key)) return '⇅';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  toggleYear(year: number) {
    const current = new Set(this.collapsedYears());
    if (current.has(year)) current.delete(year);
    else current.add(year);
    this.collapsedYears.set(current);
  }

  getTrend(index: number): PivotTrend | null {
    const data = this.sortedData();
    if (index >= data.length - 1) return null;

    const current = data[index].monthsTotal;
    const previous = data[index + 1].monthsTotal;

    const trendMonths = current.map((val, i) => {
      const prevVal = previous[i];
      if (prevVal === 0) return val > 0 ? 100 : 0;
      return ((val - prevVal) / prevVal) * 100;
    });

    const currentTotal = data[index].yearTotal;
    const previousTotal = data[index + 1].yearTotal;
    const totalTrend =
      previousTotal === 0
        ? currentTotal > 0
          ? 100
          : 0
        : ((currentTotal - previousTotal) / previousTotal) * 100;

    return { months: trendMonths, total: totalTrend };
  }
}
