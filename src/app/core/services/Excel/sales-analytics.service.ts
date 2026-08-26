import { Injectable, computed, inject } from '@angular/core';
import { groupAndSum } from '@core/auxiliar/data-aggregation.helper';
import { getNormalizedAuditMonth, getNormalizedAuditYear } from '@core/auxiliar/sales-audit.utils';
import {
  computeMonthYoyKpi,
  computeScopedYearComparison,
} from '@core/auxiliar/sales-yoy.util';
import { SalesStateService } from './sales-state.service';
import { ProductService } from './product.service';

/** Derived KPIs and chart aggregations over filtered sales data. */
@Injectable({ providedIn: 'root' })
export class SalesAnalyticsService {
  private state = inject(SalesStateService);
  private productService = inject(ProductService);

  private filteredData = this.state.filteredData;
  private allSalesData = this.state.allSalesData;
  private salesFilters = this.state.salesFilters;

  totalRevenue = computed(() => this.filteredData().reduce((acc, r) => acc + r.total, 0));

  totalUnitsSold = computed(() => this.filteredData().reduce((acc, r) => acc + r.itemQuantity, 0));

  totalOrders = computed(() => new Set(this.filteredData().map(r => r.orderId)).size);

  revenueTrend = computed(() =>
    computeMonthYoyKpi(this.allSalesData(), this.salesFilters(), r => r.total)
  );

  unitsTrend = computed(() =>
    computeMonthYoyKpi(this.allSalesData(), this.salesFilters(), r => r.itemQuantity)
  );

  yearRevenueComparison = computed(() => {
    const result = computeScopedYearComparison(
      this.allSalesData(),
      this.salesFilters(),
      r => r.total
    );
    const { account } = this.state.getFilters();
    const scopeLabel = account?.length === 1 ? `${account[0].toUpperCase()} REVENUE` : 'REVENUE';
    return { ...result, scopeLabel };
  });

  yearUnitsComparison = computed(() => {
    const result = computeScopedYearComparison(
      this.allSalesData(),
      this.salesFilters(),
      r => r.itemQuantity
    );
    const { account } = this.state.getFilters();
    const scopeLabel = account?.length === 1 ? `${account[0].toUpperCase()} UNITS` : 'UNITS';
    return { ...result, scopeLabel };
  });

  salesByChannel = computed(() => {
    const map = new Map<string, number>();
    this.filteredData().forEach(r => {
      const ch = r.channel || r.account || 'Unknown';
      map.set(ch, (map.get(ch) ?? 0) + r.total);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([channel, total]) => ({ channel, total }));
  });

  topProducts = computed(() => {
    const masterProducts = this.productService.products();
    const map = new Map<string, number>();

    this.filteredData().forEach(r => {
      const sku = r.sku || 'Unknown';
      map.set(sku, (map.get(sku) ?? 0) + r.itemQuantity);
    });

    return Array.from(map.entries())
      .map(([sku, quantity]) => {
        const parent = sku.split('-')[0];
        const info = masterProducts.find(p => p.parent.toLowerCase() === parent.toLowerCase());
        const typeName = info?.type || 'Uncategorized';
        return { title: sku, category: typeName, quantity };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  salesByMonth = computed(() =>
    groupAndSum(
      this.filteredData(),
      r => {
        const year = String(r.auditYear || '2025').trim();
        const month = String(r.auditMonth || '1').trim().padStart(2, '0');
        return `${year}-${month}`;
      },
      r => r.total
    )
      .map(res => ({ month: res.key, total: res.total }))
      .sort((a, b) => a.month.localeCompare(b.month))
  );

  salesByWeek = computed(() =>
    groupAndSum(
      this.filteredData(),
      r => {
        if (r.channel && r.channel.startsWith('W')) {
          const y = getNormalizedAuditYear(r);
          const w = r.channel.substring(1).padStart(2, '0');
          return `${y}-W${w}`;
        }
        return `${getNormalizedAuditYear(r)}-W01`;
      },
      r => r.total
    )
      .map(res => ({ month: res.key, total: res.total }))
      .sort((a, b) => a.month.localeCompare(b.month))
  );

  salesByYear = computed(() =>
    groupAndSum(
      this.filteredData(),
      r => String(r.auditYear || '2025').trim(),
      r => r.total
    )
      .map(res => ({ month: res.key, total: res.total }))
      .sort((a, b) => a.month.localeCompare(b.month))
  );

  salesByYearComparison = computed(() => {
    const years = new Map<number, number[]>();
    const yearsUnits = new Map<number, number[]>();

    this.filteredData().forEach(r => {
      const year = getNormalizedAuditYear(r);
      const month = getNormalizedAuditMonth(r);

      if (month >= 0 && month <= 11) {
        if (!years.has(year)) {
          years.set(year, new Array(12).fill(0));
          yearsUnits.set(year, new Array(12).fill(0));
        }
        years.get(year)![month] += r.total;
        yearsUnits.get(year)![month] += r.itemQuantity;
      }
    });

    return { revenue: years, units: yearsUnits };
  });
}
