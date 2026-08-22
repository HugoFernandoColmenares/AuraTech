import { Injectable, inject } from '@angular/core';
import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { SalesStateService } from './sales-state.service';
import { SalesAnalyticsService } from './sales-analytics.service';

export { toISOWeek } from '@core/auxiliar/sales-audit.utils';

/** Facade over {@link SalesStateService} + {@link SalesAnalyticsService}. */
@Injectable({ providedIn: 'root' })
export class SalesProcessingService {
  private readonly state = inject(SalesStateService);
  private readonly analytics = inject(SalesAnalyticsService);

  readonly filteredData = this.state.filteredData;
  readonly totalRevenue = this.analytics.totalRevenue;
  readonly totalUnitsSold = this.analytics.totalUnitsSold;
  readonly totalOrders = this.analytics.totalOrders;
  readonly revenueTrend = this.analytics.revenueTrend;
  readonly yearRevenueComparison = this.analytics.yearRevenueComparison;
  readonly unitsTrend = this.analytics.unitsTrend;
  readonly yearUnitsComparison = this.analytics.yearUnitsComparison;
  readonly salesByChannel = this.analytics.salesByChannel;
  readonly topProducts = this.analytics.topProducts;
  readonly salesByMonth = this.analytics.salesByMonth;
  readonly salesByWeek = this.analytics.salesByWeek;
  readonly salesByYear = this.analytics.salesByYear;
  readonly salesByYearComparison = this.analytics.salesByYearComparison;

  setFilters(f: Partial<SalesFilters>): void {
    this.state.setFilters(f);
  }

  resetFilters(): void {
    this.state.resetFilters();
  }

  getFilters(): SalesFilters {
    return this.state.getFilters();
  }

  setSalesData(data: ISaleRecordDto[]): void {
    this.state.setSalesData(data);
  }

  getSalesData(): ISaleRecordDto[] {
    return this.state.getSalesData();
  }

  getLocalPendingData(): ISaleRecordDto[] {
    return this.state.getLocalPendingData();
  }

  /** Marks pending local rows as persisted without clearing the session. */
  markLocalAsPersisted(): void {
    this.state.markLocalAsPersisted();
  }

  addSalesData(data: ISaleRecordDto[]): void {
    this.state.addSalesData(data);
  }
}
