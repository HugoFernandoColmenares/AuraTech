import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCurrencyPipe } from '@core/pipes/app-currency.pipe';
import {
  CreditCardPivotCategoryRow,
  CreditCardPivotSubRow,
  CreditCardPivotYearBlock,
} from '@core/auxiliar/credit-card-pivot.helper';
import { PIVOT_MONTHS } from '@core/constants/pivot.constants';

type SortableRow = Pick<CreditCardPivotCategoryRow, 'label' | 'months' | 'total'>;

@Component({
  selector: 'app-credit-card-pivot-table',
  standalone: true,
  imports: [CommonModule, AppCurrencyPipe],
  templateUrl: './credit-card-pivot-table.component.html',
  styleUrl: './credit-card-pivot-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditCardPivotTableComponent {
  data = input.required<CreditCardPivotYearBlock[]>();
  selectedMonthIndices = input<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  currencyDigits = input('1.2-2');
  sortable = input(true);

  readonly monthOptions = PIVOT_MONTHS;

  sortKey = signal('total');
  sortDir = signal<'asc' | 'desc'>('desc');

  /** Collapsed years hide category and channel detail rows. */
  private collapsedYears = signal<Set<number>>(new Set());

  /** Collapsed category keys (`year::label`) hide channel sub-rows. */
  private collapsedCategories = signal<Set<string>>(new Set());

  visibleMonthIndices = computed(() => this.selectedMonthIndices());

  sortedData = computed(() => {
    const blocks = this.data();
    if (!this.sortable()) return blocks;

    const key = this.sortKey();
    const factor = this.sortDir() === 'asc' ? 1 : -1;

    return blocks.map(block => ({
      ...block,
      categories: [...block.categories]
        .sort((a, b) => this.compareRows(a, b, key, factor))
        .map(category => ({
          ...category,
          subRows: [...category.subRows].sort((a, b) => this.compareRows(a, b, key, factor)),
        })),
    }));
  });

  monthLabel(monthIndex: number): string {
    return this.monthOptions.find(m => m.value === monthIndex)?.label ?? String(monthIndex + 1);
  }

  categoryKey(year: number, label: string): string {
    return `${year}::${label}`;
  }

  isYearCollapsed(year: number): boolean {
    return this.collapsedYears().has(year);
  }

  toggleYear(year: number): void {
    this.collapsedYears.update(current => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  isCategoryCollapsed(year: number, label: string): boolean {
    return this.collapsedCategories().has(this.categoryKey(year, label));
  }

  toggleCategory(year: number, label: string, hasSubRows: boolean): void {
    if (!hasSubRows) return;

    const key = this.categoryKey(year, label);
    this.collapsedCategories.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  monthTotal(block: CreditCardPivotYearBlock, monthIndex: number): number {
    return block.monthsTotal[monthIndex] ?? 0;
  }

  filteredTotal(values: number[]): number {
    return this.visibleMonthIndices().reduce(
      (sum, index) => sum + (values[index] ?? 0),
      0
    );
  }

  private compareRows(
    a: SortableRow | CreditCardPivotSubRow,
    b: SortableRow | CreditCardPivotSubRow,
    key: string,
    factor: number
  ): number {
    if (key === 'label') {
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) * factor;
    }
    if (key === 'total') {
      return (this.filteredTotal(a.months) - this.filteredTotal(b.months)) * factor;
    }
    if (key.startsWith('month-')) {
      const idx = Number(key.replace('month-', ''));
      return ((a.months[idx] ?? 0) - (b.months[idx] ?? 0)) * factor;
    }
    return 0;
  }
}
