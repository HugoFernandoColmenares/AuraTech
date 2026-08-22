import { Injectable, inject } from '@angular/core';
import { DateUtils } from '@core/auxiliar/date.utils';
import { AlertService } from '@core/services/Utils/alert.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { EnvConfig } from '@core/config/env.config';
import * as XLSX from 'xlsx';
import { SalesProcessingService } from '../Excel/sales-processing.service';
import { ProductService } from '../Excel/product.service';

export interface ExcelExportOptions {
  rows: Record<string, unknown>[];
  sheetName: string;
  filePrefix: string;
  entityLabel: string;
}

@Injectable({
  providedIn: 'root',
})
export class DataExportService {
  private salesService = inject(SalesProcessingService);
  private productService = inject(ProductService);
  private alertService = inject(AlertService);
  private healthService = inject(HealthService);
  private env = inject(EnvConfig);

  exportRowsToExcel(options: ExcelExportOptions): boolean {
    if (!options.rows.length) {
      this.alertService.exportEmpty(options.entityLabel);
      return false;
    }

    const ws = XLSX.utils.json_to_sheet(options.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options.sheetName);
    XLSX.writeFile(wb, `${options.filePrefix}_${this.getTimestamp()}.xlsx`);
    this.alertService.exportComplete(options.entityLabel, options.rows.length);
    return true;
  }

  async exportFromDatabase<T>(options: {
    fetch: () => Promise<T[]>;
    mapRow?: (row: T) => Record<string, unknown>;
    sheetName: string;
    filePrefix: string;
    entityLabel: string;
  }): Promise<void> {
    if (!this.canReachDatabase()) {
      this.alertService.databaseConnectionFailed();
      return;
    }

    try {
      const rows = await options.fetch();
      const mapped = options.mapRow
        ? rows.map(options.mapRow)
        : (rows as unknown as Record<string, unknown>[]);
      this.exportRowsToExcel({
        rows: mapped,
        sheetName: options.sheetName,
        filePrefix: options.filePrefix,
        entityLabel: options.entityLabel,
      });
    } catch {
      this.alertService.error('Export failed', `Could not export ${options.entityLabel} from the database.`);
    }
  }

  exportSalesSessionToExcel(): void {
    const data = this.salesService.getSalesData();
    this.exportRowsToExcel({
      rows: data as unknown as Record<string, unknown>[],
      sheetName: 'Sales',
      filePrefix: 'auratech_sales_export',
      entityLabel: 'sales records',
    });
  }

  exportCatalogToExcel(): void {
    const data = this.productService.products().filter(p => p.isActive);
    this.exportRowsToExcel({
      rows: data as unknown as Record<string, unknown>[],
      sheetName: 'Catalog',
      filePrefix: 'auratech_catalog_export',
      entityLabel: 'products',
    });
  }

  exportSalesToJSON(rows = this.salesService.filteredData()): void {
    if (!rows.length) {
      this.alertService.exportEmpty('filtered sales records');
      return;
    }

    this.downloadJson(rows, `auratech_sales_export_${this.getTimestamp()}.json`);
    this.alertService.exportComplete('sales records', rows.length);
  }

  private canReachDatabase(): boolean {
    return this.env.supabaseConfigured && this.healthService.isHealthy();
  }

  private downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private getTimestamp(): string {
    return DateUtils.formatToDateString(DateUtils.now());
  }
}
