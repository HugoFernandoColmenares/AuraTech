import { Component, input, output, model, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { DateUtils } from '@core/auxiliar/date.utils';

@Component({
  selector: 'app-main-table-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerModule],
  templateUrl: './main-table-filter.component.html',
  styleUrl: './main-table-filter.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainTableFilterComponent {
  showSearch = input(true);
  showAccounts = input(true);
  showDates = input(true);
  searchPlaceholder = input('Search SKU, Account, details...');

  availableAccounts = input<string[]>([]);

  searchQuery = model('');
  selectedAccounts = model<string[]>([]);
  startDate = model('');
  endDate = model('');

  clearFilters = output<void>();

  showAccountMenu = signal(false);

  readonly calendarDateFormat = 'mm-dd-yy';

  startDateModel = computed(() => this.toDateModel(this.startDate()));
  endDateModel = computed(() => this.toDateModel(this.endDate()));

  toggleAccount(acc: string) {
    this.selectedAccounts.update(prev =>
      prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]
    );
  }

  onClearAccounts() {
    this.selectedAccounts.set([]);
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
  }

  onStartDateChange(value: Date | null) {
    this.startDate.set(this.fromDateModel(value));
  }

  onEndDateChange(value: Date | null) {
    this.endDate.set(this.fromDateModel(value));
  }

  onClear() {
    this.clearFilters.emit();
  }

  private toDateModel(iso: string): Date | null {
    if (!iso) return null;
    return DateUtils.calendarDateFromIso(iso);
  }

  private fromDateModel(date: Date | null): string {
    if (!date) return '';
    return DateUtils.formatCalendarDate(date);
  }
}
