import { Injectable, signal, computed, inject } from '@angular/core';
import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { filterSaleRecords } from '@core/auxiliar/sales-filter.util';
import { isPreAggregatedSaleRow } from '@core/auxiliar/sale-record-curation.util';
import { SalesRecordCurationService } from '@core/services/Excel/sales-record-curation.service';

/** Session state: raw sales rows, filters, and filtered view. */
@Injectable({ providedIn: 'root' })
export class SalesStateService {
  private curation = inject(SalesRecordCurationService);
  private salesData = signal<ISaleRecordDto[]>([]);

  private filters = signal<SalesFilters>({
    search: '',
    account: [],
    startDate: null,
    endDate: null,
    months: [],
  });

  setFilters(f: Partial<SalesFilters>): void {
    this.filters.update(curr => ({ ...curr, ...f }));
  }

  resetFilters(): void {
    this.filters.set({
      search: '',
      account: [],
      startDate: null,
      endDate: null,
      months: [],
    });
  }

  getFilters(): SalesFilters {
    return this.filters();
  }

  readonly salesFilters = this.filters.asReadonly();
  readonly allSalesData = this.salesData.asReadonly();

  filteredData = computed(() => {
    const rows = filterSaleRecords(this.salesData(), this.filters());
    // Pending session rows: show most recently parsed lines first (matches DB `created_at` desc).
    if (rows.length > 0 && rows.every(r => r.isLocal)) {
      return [...rows].sort((a, b) => (b.idx ?? 0) - (a.idx ?? 0));
    }
    return rows;
  });

  setSalesData(data: ISaleRecordDto[]): void {
    const isRpcAggregate = data.length > 0 && data.every(row => row.sku === 'AGG' && String(row.id ?? '').startsWith('agg-'));
    const hasBlockedAgg = data.some(isPreAggregatedSaleRow);
    if (hasBlockedAgg && !isRpcAggregate) {
      this.salesData.set(this.curation.curateFromDatabase(data));
      return;
    }
    this.salesData.set(
      isRpcAggregate
        ? this.curation.curateCollection(data, { dedupe: false, preserveIsLocal: true })
        : this.curation.curateFromDatabase(data)
    );
  }

  getSalesData(): ISaleRecordDto[] {
    return this.salesData();
  }

  /** Rows imported in this browser session that are not yet in Supabase. */
  getLocalPendingData(): ISaleRecordDto[] {
    return this.salesData().filter(r => r.isLocal);
  }

  /**
   * Marks all pending local rows as persisted (isLocal = false) WITHOUT clearing
   * the session. Used after a successful "Export to DB" so the rows stay visible
   * while the analytics MV refreshes in the background, avoiding the "data
   * disappeared" perception during the refresh window.
   */
  markLocalAsPersisted(): void {
    this.salesData.update(rows => rows.map(r => ({ ...r, isLocal: false })));
  }

  addSalesData(data: ISaleRecordDto[]): void {
    const curated = this.curation.curateExcelImport(data);

    this.salesData.update(current => {
      // Session holds only pending uploads — never merge server/analytics rows here.
      const localOnly = current.filter(r => r.isLocal);
      const isGenericReport = curated.length > 0 && curated[0]?.warehouseCode === 'GEN';

      if (isGenericReport) {
        return this.curation.curateFromDatabase([
          ...localOnly,
          ...curated.map(item => ({ ...item })),
        ]);
      }

      const updated = [...localOnly];
      curated.forEach(newItem => {
        const existingIdx = updated.findIndex(
          i =>
            i.orderId === newItem.orderId &&
            i.sku === newItem.sku &&
            i.idx === newItem.idx
        );
        if (existingIdx !== -1) {
          updated[existingIdx] = newItem;
        } else {
          updated.push(newItem);
        }
      });
      return this.curation.curateFromDatabase(updated);
    });
  }
}
