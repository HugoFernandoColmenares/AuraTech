import { Component, inject, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateUtils } from '@core/auxiliar/date.utils';
import { InsightsReportComponent } from '@shared/components/insights/insights-report.component';
import { LoadingService } from '@core/services/Utils/loading.service';
import { CreditCardReportService } from '@core/services/Excel/credit-card-report.service';
import { ViewMode } from '@core/interfaces/chart.interface';
import { AlertService } from '@core/services/Utils/alert.service';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { CreditCardTransactionsApiService } from '@core/services/api/credit-card-transactions-api.service';
import { DataExportService } from '@core/services/Utils/data-export.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';
import { CreditCardTableComponent } from './components/credit-card-table/credit-card-table.component';
import { CreditCardAnalyticsComponent } from './components/credit-card-analytics/credit-card-analytics.component';
import { CreditCardModalComponent } from './components/credit-card-modal/credit-card-modal.component';
import { ViewControlsComponent } from '@shared/components/view-controls/view-controls.component';
import { ReportUploadPlaceholderComponent } from '@shared/components/report-upload-placeholder/report-upload-placeholder.component';
import {
  compareCreditCardDatesDesc,
  normalizeCreditCardRecords,
} from '@core/auxiliar/credit-card-date.util';
import { mapCreditCardChannel } from '@core/pipes/credit-card-channel-display.pipe';
import { ViewModeOption } from '@core/interfaces/view-controls.interface';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { confirmAndRemoveBatch } from '@core/auxiliar/batch-record-delete.util';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { ReportAnalyticsApiService } from '@core/services/api/report-analytics-api.service';
import {
  creditCardAggregatesToTransactions,
  mapRpcCreditCardTrend,
  mapRpcCreditCardYearComparison,
  mapRpcLastMonthKpi,
} from '@core/auxiliar/report-analytics-rpc.mapper';
import { resolveCreditCardFocusYear } from '@core/auxiliar/credit-card-kpi.util';
import { resolveReportDataSourceCounts } from '@core/auxiliar/data-source-count.util';
import { mergeLocalAndServer } from '@core/auxiliar/local-server-merge.util';
import type {
  CreditCardKpiSummary,
  CreditCardLastMonthSummary,
  CreditCardYearComparison,
} from '@core/auxiliar/credit-card-kpi.util';

const ANALYTICS_VIEWS = new Set<ViewMode>(['charts', 'insights']);

@Component({
  selector: 'app-credit-card-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule, InsightsReportComponent,
    MainTableFilterComponent,
    CreditCardTableComponent, CreditCardAnalyticsComponent, CreditCardModalComponent,
    ViewControlsComponent, ReportUploadPlaceholderComponent,
  ],
  templateUrl: './credit-card-report.component.html',
  styleUrl: './credit-card-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardReportComponent implements OnInit {
  reportService = inject(CreditCardReportService);
  loadingService = inject(LoadingService);
  private alertService = inject(AlertService);
  private transactionsApi = inject(CreditCardTransactionsApiService);
  private dataExport = inject(DataExportService);
  private healthService = inject(HealthService);
  private bulkSync = inject(BulkSyncService);
  private authService = inject(AuthService);
  private appStartup = inject(AppStartupService);
  private sessionCache = inject(ReportSessionCacheService);
  private reportAnalytics = inject(ReportAnalyticsApiService);
  private rolePermissions = inject(RolePermissionService);

  useServerAnalytics = signal(false);
  serverLastMonthKpi = signal<CreditCardLastMonthSummary | null>(null);
  serverSpendTrendKpi = signal<CreditCardKpiSummary | null>(null);
  serverYearComparisonKpi = signal<CreditCardYearComparison | null>(null);
  private analyticsFetchGeneration = 0;
  private lastServerFilterKey = '';

  @ViewChild('addFileInput') addFileInput!: ElementRef<HTMLInputElement>;

  isLoading = this.loadingService.isLoading;
  initialDataReady = signal(false);
  analyticsReady = signal(false);
  analyticsLoading = signal(false);
  showImportModal = signal(false);
  pendingFile: File | null = null;
  pendingFileName = computed(() => this.pendingFile?.name ?? '');
  viewMode = signal<ViewMode>('charts');

  /** Historical server rows kept separate from the local pending session. */
  private serverHistoricalRows = signal<ICreditCardTransactionDto[]>([]);
  readonly viewOptions: ViewModeOption[] = [
    { id: 'charts', label: 'Analytics', icon: '📊' },
    { id: 'table', label: 'Table', icon: '📋' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];
  searchQuery = signal('');
  startDate = signal('');
  endDate = signal('');

  private readonly tablePageSize = 20;
  private tablePage = signal(1);
  tableSelectionReset = signal(0);
  tableRows = signal<ICreditCardTransactionDto[]>([]);
  totalRecords = signal(0);

  tableUseServerSide = computed(
    () =>
      this.healthService.isHealthy() &&
      !this.hasLocalData() &&
      (this.viewMode() === 'table' || !this.analyticsReady())
  );

  hasLocalData = computed(() =>
    this.reportService.transactions().some(r => r.isLocal)
  );
  dataSourceCounts = computed(() =>
    resolveReportDataSourceCounts({
      hasLocalSession: this.hasLocalData(),
      sessionRows: this.reportService.transactions(),
      databaseTotal: this.totalRecords(),
    })
  );
  hasData = computed(() =>
    this.totalRecords() > 0 || this.reportService.transactions().length > 0
  );
  showUpload = computed(() => this.initialDataReady() && !this.hasData());
  isInitialLoad = computed(() => !this.initialDataReady());
  showDashboard = computed(() => this.initialDataReady() && this.hasData());
  filteredCount = computed(() => this.filteredRows().length);
  insightsReport = this.reportService.insightsReport;

  private dataSource = computed(() => {
    if (this.hasLocalData()) {
      // Merge pending local rows with the server history so the table/analytics
      // show the full picture. Local rows win on id collisions.
      const merged = mergeLocalAndServer(
        this.reportService.getLocalPendingData(),
        this.serverHistoricalRows(),
        r => r.id ?? ''
      );
      return normalizeCreditCardRecords(merged);
    }
    const rows = this.analyticsReady()
      ? this.reportService.transactions()
      : this.tableRows();
    return normalizeCreditCardRecords(rows);
  });

  searchFilteredRows = computed<ICreditCardTransactionDto[]>(() => {
    let data = this.dataSource();
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      data = data.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        mapCreditCardChannel(t.channel).toLowerCase().includes(query) ||
        t.dept?.toLowerCase().includes(query)
      );
    }
    return data;
  });

  hasDateFilter = computed(() => !!(this.startDate() || this.endDate()));

  filteredRows = computed<ICreditCardTransactionDto[]>(() => {
    let data = this.searchFilteredRows();
    const start = this.startDate();
    const end = this.endDate();

    if (start) {
      const sDate = DateUtils.parseIsoDate(start);
      if (sDate) {
        data = data.filter(t => {
          const recordDate = DateUtils.parseDate(t.date);
          return recordDate != null && recordDate >= sDate;
        });
      }
    }
    if (end) {
      const eDate = DateUtils.endOfIsoDay(end);
      if (eDate) {
        data = data.filter(t => {
          const recordDate = DateUtils.parseDate(t.date);
          return recordDate != null && recordDate <= eDate;
        });
      }
    }

    return [...data].sort(compareCreditCardDatesDesc);
  });

  tableDisplayRows = computed(() => {
    const rows = this.tableUseServerSide()
      ? this.tableRows()
      : this.filteredRows();

    return rows.map(row => ({
      ...row,
      channel: mapCreditCardChannel(row.channel || row.salesChannel),
    }));
  });

  ngOnInit(): void {
    void this.loadInitialData();
  }

  constructor() {
    effect(() => {
      if (!this.useServerAnalytics() || !this.analyticsReady() || this.hasLocalData()) return;
      const key = JSON.stringify({
        search: this.searchQuery(),
        start: this.startDate(),
        end: this.endDate(),
      });
      if (!this.lastServerFilterKey) {
        this.lastServerFilterKey = key;
        return;
      }
      if (key === this.lastServerFilterKey) return;
      this.lastServerFilterKey = key;
      this.scheduleServerAnalyticsReload();
    });
  }

  private scheduleServerAnalyticsReload(): void {
    const generation = ++this.analyticsFetchGeneration;
    void this.loadAnalyticsFromServer(generation);
  }

  private applyCreditCardServerBundle(
    bundle: NonNullable<Awaited<ReturnType<ReportAnalyticsApiService['fetchCreditCardAnalytics']>>>
  ): void {
    this.serverLastMonthKpi.set(mapRpcLastMonthKpi(bundle.kpis.last_month));
    this.serverSpendTrendKpi.set(mapRpcCreditCardTrend(bundle.kpis.month_trend));
    this.serverYearComparisonKpi.set(mapRpcCreditCardYearComparison(bundle.kpis.year_comparison));
    void this.reportService.setTransactions(creditCardAggregatesToTransactions(bundle.monthly ?? []));
    this.useServerAnalytics.set(true);
    this.lastServerFilterKey = '';
    this.analyticsReady.set(true);
  }

  private async loadAnalyticsFromServer(expectedGeneration?: number): Promise<void> {
    // When a local session is active, load historical server rows in the
    // background so the table/analytics can merge local + server data.
    if (this.hasLocalData()) {
      if (this.serverHistoricalRows().length > 0) return;
      try {
        const rows = await this.transactionsApi.fetchAllForAnalytics();
        this.serverHistoricalRows.set(rows.map(r => ({ ...r, isLocal: false })));
      } catch (err: unknown) {
        console.error('[CreditCard] loadServerHistoryForLocalSession failed:', err);
      }
      return;
    }

    const isInitial = expectedGeneration === undefined;
    if (isInitial && (this.analyticsLoading() || this.analyticsReady())) return;
    if (!isInitial && expectedGeneration !== this.analyticsFetchGeneration) return;

    if (isInitial) {
      this.analyticsLoading.set(true);
    }

    try {
      const focusYear = resolveCreditCardFocusYear([], this.reportService.transactions());
      const bundle = await this.reportAnalytics.fetchCreditCardAnalytics({
        search: this.searchQuery(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        focusYear,
      });

      if (expectedGeneration !== undefined && expectedGeneration !== this.analyticsFetchGeneration) {
        return;
      }

      if (bundle) {
        this.applyCreditCardServerBundle(bundle);
        return;
      }

      this.useServerAnalytics.set(false);
      this.serverLastMonthKpi.set(null);
      this.serverSpendTrendKpi.set(null);
      this.serverYearComparisonKpi.set(null);

      const rows = await this.transactionsApi.fetchAllForAnalytics();
      if (rows.length) {
        this.serverHistoricalRows.set(rows.map(r => ({ ...r, isLocal: false })));
        await this.reportService.setTransactions(rows);
      }
      this.analyticsReady.set(true);
    } catch (err: unknown) {
      console.error('Failed to load credit card analytics:', err);
      this.alertService.databaseConnectionFailed();
    } finally {
      if (isInitial) {
        this.analyticsLoading.set(false);
      }
    }
  }

  private async loadInitialData(): Promise<void> {
    await this.appStartup.whenReady();
    await this.healthService.whenReady();
    await this.authService.whenReady();

    if (this.hasLocalData()) {
      this.totalRecords.set(this.reportService.transactions().length);
      this.analyticsReady.set(true);
      this.initialDataReady.set(true);
      return;
    }

    try {
      await this.fetchPaginatedTable(1, this.tablePageSize);
      void this.ensureAnalyticsLoaded();
    } catch (err: unknown) {
      console.error('Failed to load credit card transactions:', err);
      this.initialDataReady.set(true);
    }
  }

  async fetchPaginatedTable(page: number, limit: number): Promise<void> {
    if (this.hasLocalData()) {
      this.initialDataReady.set(true);
      return;
    }

    const res = await this.transactionsApi.getPaginated(page, limit);
    const data = res.data ?? [];
    this.tablePage.set(page);
    this.tableRows.set(normalizeCreditCardRecords(data));
    this.totalRecords.set(res.meta?.totalItems ?? data.length);
    this.initialDataReady.set(true);
  }

  private ensureAnalyticsLoaded(): void {
    if (!ANALYTICS_VIEWS.has(this.viewMode()) || this.analyticsReady() || this.hasLocalData()) {
      return;
    }
    void this.loadAnalyticsFromServer();
  }

  private async refreshAfterMutation(): Promise<void> {
    this.sessionCache.invalidateReport('creditCard');
    this.useServerAnalytics.set(false);
    this.serverLastMonthKpi.set(null);
    this.serverSpendTrendKpi.set(null);
    this.serverYearComparisonKpi.set(null);
    this.serverHistoricalRows.set([]);
    this.tableSelectionReset.update(n => n + 1);
    this.analyticsReady.set(false);
    await this.fetchPaginatedTable(this.tablePage(), this.tablePageSize);
    if (!this.hasLocalData()) {
      this.analyticsFetchGeneration++;
      await this.loadAnalyticsFromServer();
    }
  }

  handleTableAction(event: { action: string; row: unknown }): void {
    const row = event.row as ICreditCardTransactionDto;
    if (event.action === 'delete') {
      if (!this.rolePermissions.can('delete')) {
        this.alertService.error('Access denied', 'You do not have permission to delete records.');
        return;
      }
      void this.confirmDelete(row);
    }
  }

  handleBulkTableAction(event: { action: string; rows: unknown[] }): void {
    if (event.action !== 'bulkDelete') return;
    if (!this.rolePermissions.can('delete')) {
      this.alertService.error('Access denied', 'You do not have permission to delete records.');
      return;
    }
    void this.confirmBulkDelete(event.rows as ICreditCardTransactionDto[]);
  }

  private resolveDeleteId(row: ICreditCardTransactionDto): string | null {
    const id = row.id?.trim();
    if (!id || id.startsWith('agg-')) return null;
    return id;
  }

  async confirmDelete(row: ICreditCardTransactionDto): Promise<void> {
    const id = this.resolveDeleteId(row);
    if (!id) {
      this.alertService.warning('Cannot delete', 'This row has no database id.');
      return;
    }

    const result = await this.alertService.confirm(
      'Delete transaction?',
      `Remove "${row.description}" from the database?`
    );
    if (!result.isConfirmed) return;

    try {
      await this.transactionsApi.remove(id);
      this.alertService.success('Deleted', 'Transaction removed successfully.');
      await this.refreshAfterMutation();
    } catch {
      this.alertService.error('Error', 'Could not delete the transaction.');
    }
  }

  async confirmBulkDelete(rows: ICreditCardTransactionDto[]): Promise<void> {
    const deletable = rows.filter(row => this.resolveDeleteId(row));
    if (!deletable.length) {
      this.alertService.warning('Cannot delete', 'Selected rows have no database id.');
      return;
    }

    const removed = await confirmAndRemoveBatch({
      rows: deletable.map(row => ({ id: this.resolveDeleteId(row)! })),
      alertService: this.alertService,
      confirmTitle: 'Delete selected transactions?',
      confirmMessage: count =>
        `This will permanently remove ${count} transaction${count === 1 ? '' : 's'}.`,
      remove: id => this.transactionsApi.remove(id),
      successMessage: (deletedRows: any[]) =>
        `${deletedRows.length} transaction${deletedRows.length === 1 ? '' : 's'} removed successfully: ${deletedRows.map(r => r.description || r.id).join(', ')}.`,
    });

    if (removed) {
      await this.refreshAfterMutation();
    }
  }

  downloadJson(): void {
    this.dataExport.exportCreditCardToJSON();
  }

  async exportTableToExcel(): Promise<void> {
    if (this.hasLocalData()) {
      this.dataExport.exportCreditCardSessionToExcel();
      return;
    }

    await this.dataExport.exportFromDatabase({
      fetch: () => this.transactionsApi.fetchAll(5000),
      mapRow: row => ({
        ...row,
        date: row.date instanceof Date ? row.date.toISOString() : row.date,
      }),
      sheetName: 'Transactions',
      filePrefix: 'ymi_credit_card_export',
      entityLabel: 'transactions',
    });
  }

  triggerAddData(): void {
    this.addFileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.pendingFile = file;
    this.showImportModal.set(true);
    input.value = '';
  }

  cancelImport(): void {
    this.showImportModal.set(false);
    this.pendingFile = null;
  }

  async confirmImport(): Promise<void> {
    const file = this.pendingFile;
    if (!file) return;

    this.showImportModal.set(false);
    this.loadingService.begin('Processing credit card statement…');

    try {
      const prevCount = this.reportService.transactions().length;

      if (!prevCount && this.tableRows().length) {
        await this.reportService.setTransactions(this.tableRows());
      }

      await this.reportService.parseExcelFile(file);
      const newCount = this.reportService.transactions().length;
      this.totalRecords.set(newCount);
      this.tableRows.set([]);
      this.analyticsReady.set(true);
      this.initialDataReady.set(true);
      this.viewMode.set('charts');
      // Load server history in the background so analytics show local + historical data.
      void this.loadAnalyticsFromServer();
      this.alertService.success('Success', `Imported ${newCount - prevCount} transactions from ${file.name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to parse credit card statement';
      console.error('Error parsing credit card file:', err);
      this.alertService.error('Error', message);
    } finally {
      this.loadingService.end();
      this.pendingFile = null;
    }
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.startDate.set('');
    this.endDate.set('');
  }

  setViewMode(mode: string): void {
    this.viewMode.set(mode as ViewMode);
    void this.ensureAnalyticsLoaded();
  }

  resetData(): void {
    this.reportService.resetData();
    this.tableRows.set([]);
    this.totalRecords.set(0);
    this.analyticsReady.set(false);
    this.viewMode.set('table');
    this.clearFilters();
    this.initialDataReady.set(true);
  }

  async exportToDatabase(): Promise<void> {
    await this.bulkSync.exportLocalRecords({
      records: this.reportService.transactions().filter(r => r.isLocal),
      upload: rows => this.transactionsApi.bulkUpload(rows),
      entityLabel: 'transactions',
      emptyMessage: 'There are no session transactions to export.',
      onSuccess: () => this.refreshAfterMutation(),
    });
  }
}
