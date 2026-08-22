import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '@core/services/bootstrap/health.service';
import { AppDataBootstrapService } from '@core/services/bootstrap/app-data-bootstrap.service';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { SaleRecordsCurationApiService } from '@core/services/api/sale-records-curation-api.service';
import { ReportAnalyticsApiService } from '@core/services/api/report-analytics-api.service';
import { ISaleRecordCureResult } from '@core/interfaces/sale-record-cure.interface';

@Component({
  selector: 'app-data-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-management.component.html',
  styleUrl: './data-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataManagementComponent {
  private healthService = inject(HealthService);
  private bootstrap = inject(AppDataBootstrapService);
  private reportCache = inject(ReportSessionCacheService);
  private alertService = inject(AlertService);
  private salesCurationApi = inject(SaleRecordsCurationApiService);
  private reportAnalytics = inject(ReportAnalyticsApiService);

  isDatabaseHealthy = this.healthService.isHealthy;
  isChecking = this.healthService.isChecking;
  curePreview = signal<ISaleRecordCureResult | null>(null);
  cureBusy = signal(false);
  analyticsRefreshBusy = signal(false);

  async verifyServerConnection(): Promise<void> {
    const wasUnavailable = !this.isDatabaseHealthy();
    const healthy = await this.healthService.recheckConnection();

    if (healthy) {
      this.reportCache.clearAll();
      this.bootstrap.resetCaches();
      await this.bootstrap.warmCaches();

      this.alertService.success(
        'Server Online',
        wasUnavailable
          ? 'The database is reachable. Reload the page to refresh report modules with live data.'
          : 'The database is reachable and responding correctly.'
      );
      return;
    }

    this.alertService.databaseConnectionFailed();
  }

  clearAllData(): void {
    if (confirm('Are you sure you want to clear all session data? This action cannot be undone.')) {
      localStorage.clear();
      location.reload();
    }
  }

  async previewSalesCure(): Promise<void> {
    if (!this.isDatabaseHealthy()) {
      this.alertService.databaseConnectionFailed();
      return;
    }

    this.cureBusy.set(true);
    try {
      const res = await this.salesCurationApi.previewCure();
      if (!res.success || !res.data) {
        this.alertService.error('Preview failed', res.message ?? 'Could not analyze sales data.');
        return;
      }
      this.curePreview.set(res.data);
      this.alertService.info(
        'Sales cure preview',
        `${res.data.totalWouldChange} rows need adjustment (invalid: ${res.data.invalidRemoved}, AGG subtotals: ${res.data.aggRemoved}, Shopify summary: ${res.data.summaryRemoved}, mirror lines: ${res.data.lineCollapsed}, duplicates: ${res.data.duplicatesRemoved}).`
      );
    } finally {
      this.cureBusy.set(false);
    }
  }

  async applySalesCure(): Promise<void> {
    if (!this.isDatabaseHealthy()) {
      this.alertService.databaseConnectionFailed();
      return;
    }

    const preview = this.curePreview();
    const total = preview?.totalWouldChange ?? 0;
    const confirmed = confirm(
      total > 0
        ? `Apply curation in Supabase? This will remove or normalize ${total} rows according to Excel import rules.`
        : 'Run sales curation in Supabase?'
    );
    if (!confirmed) return;

    this.cureBusy.set(true);
    try {
      const res = await this.salesCurationApi.applyCure();
      if (!res.success || !res.data) {
        this.alertService.error('Cure failed', res.message ?? 'Could not cure sales data.');
        return;
      }
      this.curePreview.set(res.data);
      this.reportCache.clearAll();
      this.alertService.success(
        'Sales cured',
        `Removed ${res.data.invalidRemoved + res.data.aggRemoved + res.data.summaryRemoved + res.data.lineCollapsed + res.data.duplicatesRemoved} rows; ${res.data.normalized} normalized. Reload Sales Report to see changes.`
      );
    } finally {
      this.cureBusy.set(false);
    }
  }

  async refreshSalesAnalytics(): Promise<void> {
    if (!this.isDatabaseHealthy()) {
      this.alertService.databaseConnectionFailed();
      return;
    }

    this.analyticsRefreshBusy.set(true);
    try {
      const ok = await this.reportAnalytics.refreshSalesAnalyticsView(true);
      if (ok) {
        this.reportCache.clearAll();
        this.alertService.success(
          'Analytics refreshed',
          'Materialized view updated. Reload Sales Report to see updated KPIs.'
        );
      } else {
        this.alertService.warning(
          'Refresh unavailable',
          'The refresh_sale_records_analytics function is not available in Supabase. Apply migration 20250615100000.'
        );
      }
    } finally {
      this.analyticsRefreshBusy.set(false);
    }
  }
}
