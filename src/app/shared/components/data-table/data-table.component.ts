import { Component, input, output, signal, computed, effect, untracked, ChangeDetectionStrategy, inject, ElementRef, viewChild, } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../pagination/pagination.component';
import { RolePermissionService } from '@core/services/auth/role-permission.service';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'date' | 'badge' | 'number' | 'percent' | 'action' | 'custom';
  cssClass?: string;
  sortable?: boolean;
}

export interface TableBulkActionEvent<T = unknown> {
  action: string;
  rows: T[];
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent {
  private readonly permissions = inject(RolePermissionService);
  private readonly selectAllCheckbox = viewChild<ElementRef<HTMLInputElement>>('selectAllCheckbox');

  columns = input.required<TableColumn[]>();
  data = input.required<any[]>();
  pageSize = input(10);
  defaultSortKey = input<string | null>(null);
  defaultSortDir = input<'asc' | 'desc'>('desc');
  clickableRows = input(false);
  showViewAction = input(true);
  showEditAction = input<boolean | null>(null);
  showDeleteAction = input<boolean | null>(null);

  /** When null, row selection is enabled for delete-capable tables with an actions column. */
  selectable = input<boolean | null>(null);
  rowKey = input('id');
  selectionReset = input(0);

  canEdit = computed(() => this.showEditAction() ?? this.permissions.canEdit());
  canDelete = computed(() => this.showDeleteAction() ?? this.permissions.canDelete());
  hasActionColumn = computed(() => this.columns().some(col => col.type === 'action'));

  showSelection = computed(() => {
    const enabled = this.selectable();
    if (enabled === false) return false;
    if (!this.canDelete()) return false;
    if (enabled === true) return true;
    return this.hasActionColumn();
  });

  showBulkToolbar = computed(() => this.showSelection() && (this.selectedCount() >= 2 || this.allPageSelected()));

  // Server-side pagination support
  serverSide = input(false);
  totalRecords = input(0);
  /** When server-side, parent owns the active page (e.g. after filter reset). */
  page = input(1);
  footer = input<any>(null);

  actionClick = output<{ action: string, row: any }>();
  bulkActionClick = output<TableBulkActionEvent>();
  selectionChange = output<string[]>();
  pageChange = output<number>();
  rowClick = output<any>();

  currentPage = signal(1);
  sortKey = signal<string | null>(null);
  sortDir = signal<'asc' | 'desc'>('desc');
  private selectedRowsByKey = signal<Map<string, unknown>>(new Map());

  constructor() {
    effect(() => {
      this.data();
      if (!this.serverSide()) {
        this.currentPage.set(1);
      }
    });

    effect(() => {
      this.columns();
      if (!this.serverSide()) {
        this.currentPage.set(1);
      }
    });

    effect(() => {
      const key = this.defaultSortKey();
      if (key) {
        this.sortKey.set(key);
        this.sortDir.set(this.defaultSortDir());
      }
    });

    effect(() => {
      this.selectionReset();
      untracked(() => {
        this.clearSelection(false);
      });
    });

    effect(() => {
      if (!this.serverSide()) return;
      this.currentPage.set(this.page());
    });

    effect(() => {
      this.allPageSelected();
      this.somePageSelected();
      queueMicrotask(() => this.syncHeaderCheckboxState());
    });
  }

  activeSortKey = computed(() => this.sortKey() ?? this.defaultSortKey());
  activeSortDir = computed(() => this.sortDir());

  selectedCount = computed(() => this.selectedRowsByKey().size);

  allPageSelected = computed(() => {
    const page = this.pagedData();
    if (!page.length) return false;
    const selected = this.selectedRowsByKey();
    return page.every((row, index) => selected.has(this.selectionKey(row, index)));
  });

  somePageSelected = computed(() => {
    const page = this.pagedData();
    if (!page.length) return false;
    const selected = this.selectedRowsByKey();
    const countOnPage = page.filter((row, index) => selected.has(this.selectionKey(row, index))).length;
    return countOnPage > 0 && countOnPage < page.length;
  });

  columnCount = computed(() => this.columns().length + (this.showSelection() ? 1 : 0));

  totalPages = computed(() => {
    if (this.serverSide()) {
      return Math.ceil(this.totalRecords() / this.pageSize());
    }
    return Math.ceil(this.data().length / this.pageSize());
  });
  
  sortedData = computed(() => {
    const rows = [...this.data()];
    const key = this.activeSortKey();
    if (!key) return rows;

    const dir = this.activeSortDir();
    const factor = dir === 'asc' ? 1 : -1;

    return rows.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  });

  pagedData = computed(() => {
    if (this.serverSide()) {
      return this.sortedData();
    }
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sortedData().slice(start, start + this.pageSize());
  });

  trackRow(index: number, row: Record<string, unknown>): string {
    return this.selectionKey(row, index);
  }

  rowId(row: Record<string, unknown>): string {
    const key = this.rowKey();
    const value = row[key];
    return value != null && String(value).length > 0 ? String(value) : '';
  }

  /** Stable per rendered row — avoids duplicate @for keys and selection collisions. */
  selectionKey(row: Record<string, unknown>, indexInPage: number): string {
    const base = this.rowId(row);
    const page = this.currentPage();
    return base
      ? `${base}::p${page}::i${indexInPage}`
      : `row::p${page}::i${indexInPage}`;
  }

  isSelected(row: Record<string, unknown>, indexInPage: number): boolean {
    return this.selectedRowsByKey().has(this.selectionKey(row, indexInPage));
  }

  toggleRow(row: Record<string, unknown>, indexInPage: number, checked: boolean): void {
    const key = this.selectionKey(row, indexInPage);
    this.selectedRowsByKey.update(map => {
      const next = new Map(map);
      if (checked) {
        next.set(key, row);
      } else {
        next.delete(key);
      }
      return next;
    });
    this.emitSelectionChange();
  }

  toggleSelectPage(checked: boolean): void {
    this.selectedRowsByKey.update(map => {
      const next = new Map(map);
      this.pagedData().forEach((row, index) => {
        const key = this.selectionKey(row as Record<string, unknown>, index);
        if (checked) {
          next.set(key, row);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
    this.emitSelectionChange();
  }

  onHeaderSelectChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.toggleSelectPage(input.checked);
  }

  clearSelection(emit = true): void {
    if (this.selectedRowsByKey().size === 0) return;
    this.selectedRowsByKey.set(new Map());
    if (emit) {
      this.selectionChange.emit([]);
    }
  }

  onBulkDelete(): void {
    const rows = [...this.selectedRowsByKey().values()];
    if (!rows.length) return;
    this.bulkActionClick.emit({ action: 'bulkDelete', rows });
  }

  toggleSort(column: TableColumn): void {
    if (!column.sortable) return;
    if (this.sortKey() === column.key) {
      this.sortDir.update(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(column.key);
      this.sortDir.set('desc');
    }
    this.currentPage.set(1);
  }

  sortIndicator(column: TableColumn): string {
    if (!column.sortable || this.activeSortKey() !== column.key) return '';
    return this.activeSortDir() === 'asc' ? ' ▲' : ' ▼';
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.pageChange.emit(page);
    }
  }

  onAction(action: string, row: any) {
    this.actionClick.emit({ action, row });
  }

  onRowClick(row: any): void {
    if (this.clickableRows()) {
      this.rowClick.emit(row);
    }
  }

  getBadgeClass(value: unknown): string {
    const v = String(value || '').toLowerCase();
    
    if (v === 'urgent') return 'badge--danger';
    if (v === 'priority') return 'badge--warning';
    if (v === 'good') return 'badge--success';

    const num = Number(value);
    if (!isNaN(num) && typeof value === 'number') {
      if (num <= 1) return 'badge--danger';
      if (num < 50) return 'badge--warning';
      return 'badge--success';
    }

    if (v.includes('available') || v.includes('shipped') || v.includes('complete')) return 'badge--success';
    if (v.includes('unavailable') || v.includes('canceled') || v.includes('error')) return 'badge--danger';
    if (v.includes('pending') || v.includes('processing')) return 'badge--warning';
    return 'badge--info';
  }

  isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  formatValue(val: unknown): string {
    if (this.isObject(val)) {
      return (val['name'] as string) || (val['label'] as string) || JSON.stringify(val);
    }
    return String(val ?? '');
  }

  private syncHeaderCheckboxState(): void {
    const input = this.selectAllCheckbox()?.nativeElement;
    if (!input) return;
    input.indeterminate = this.somePageSelected();
  }

  private emitSelectionChange(): void {
    this.selectionChange.emit([...this.selectedRowsByKey().keys()]);
  }
}
