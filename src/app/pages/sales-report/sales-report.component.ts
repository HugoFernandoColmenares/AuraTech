import { Component, inject, signal, effect, computed, ChangeDetectionStrategy, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { ExcelHandlerService } from '@core/services/Excel/excel-handler.service';
import { SalesProcessingService } from '@core/services/Excel/sales-processing.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { DateUtils } from '@core/auxiliar/date.utils';
import { ViewMode } from '@core/interfaces/chart.interface';
import { SalesFileHandlerService } from '@core/services/Excel/sales-file-handler.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { ReportUploadPlaceholderComponent } from '@shared/components/report-upload-placeholder/report-upload-placeholder.component';
import { ISaleRecordDto, StoreType } from '@core/interfaces/ISaleRecordDto.interface';
import { SaleRecordsApiService } from '@core/services/api/sale-records-api.service';
import { DataExportService } from '@core/services/Utils/data-export.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { SalesInsightsService } from '@core/services/Excel/sales-insights.service';

import { SalesAnalyticsComponent } from './components/sales-analytics/sales-analytics.component';
import { SalesTableComponent } from './components/sales-table/sales-table.component';
import { StoreSelectionModalComponent } from './components/store-selection-modal/store-selection-modal.component';
import {
  CustomMappingModalComponent,
  CustomMappingResult,
} from './components/custom-mapping-modal/custom-mapping-modal.component';
import { CustomExcelMappingService } from '@core/services/Excel/custom-excel-mapping.service';
import { InsightsReportComponent } from '@shared/components/insights/insights-report.component';
import { ViewControlsComponent } from '@shared/components/view-controls/view-controls.component';
import { RecordFormComponent } from '@shared/components/record-form/record-form.component';
import { ViewModeOption } from '@core/interfaces/view-controls.interface';
import { filterSaleRecords } from '@core/auxiliar/sales-filter.util';
import { salesTableFiltersCacheKey } from '@core/auxiliar/sales-table-filters.util';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { ReportAnalyticsApiService } from '@core/services/api/report-analytics-api.service';
import { SalesRecordCurationService } from '@core/services/Excel/sales-record-curation.service';
import { confirmAndRemoveBatch } from '@core/auxiliar/batch-record-delete.util';
import { SALES_ANALYTICS_CLIENT_FALLBACK_MAX_ROWS } from '@core/constants/sales-analytics.const';
import { mapRpcTotalsToYoyKpi, mapRpcTotalsToYearComparison, salesAggregatesToRecords, } from '@core/auxiliar/report-analytics-rpc.mapper';
import type { YearScopeComparison, YoyKpiSummary } from '@core/auxiliar/sales-yoy.util';
import { resolveReportDataSourceCounts } from '@core/auxiliar/data-source-count.util';
import { mergeLocalAndServer } from '@core/auxiliar/local-server-merge.util';
import { salesRecordBusinessKey } from '@core/auxiliar/sale-record-curation.util';

const ANALYTICS_VIEWS = new Set<ViewMode>(['charts', 'insights']);

@Component({
  selector: 'app-sales-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ CommonModule, FormsModule, MainTableFilterComponent, SalesAnalyticsComponent, SalesTableComponent, StoreSelectionModalComponent, CustomMappingModalComponent, InsightsReportComponent, ViewControlsComponent, ReportUploadPlaceholderComponent, RecordFormComponent, ],
  templateUrl: './sales-report.component.html',
  styleUrl: './sales-report.component.css'
})
export class SalesReportComponent implements OnInit {
  excelHandler = inject(ExcelHandlerService);
  salesProcessor = inject(SalesProcessingService);
  loadingService = inject(LoadingService);
  alertService = inject(AlertService);
  fileHandler = inject(SalesFileHandlerService);
  salesApi = inject(SaleRecordsApiService);
  dataExport = inject(DataExportService);
  healthService = inject(HealthService);
  salesInsightsService = inject(SalesInsightsService);
  private bulkSync = inject(BulkSyncService);
  private authService = inject(AuthService);
  private rolePermissions = inject(RolePermissionService);
  private appStartup = inject(AppStartupService);
  private sessionCache = inject(ReportSessionCacheService);
  private reportAnalytics = inject(ReportAnalyticsApiService);
  private salesCuration = inject(SalesRecordCurationService);

  useServerAnalytics = signal(false);
  private serverAvailableAccounts = signal<string[]>([]);
  private serverKpis = signal<{ revenueTrend: YoyKpiSummary; unitsTrend: YoyKpiSummary; yearRevenueComparison: YearScopeComparison; yearUnitsComparison: YearScopeComparison; } | null>(null);
  private analyticsFetchGeneration = 0;
  private lastServerFilterKey = '';
  private lastTableFilterKey = '';

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  showRecordModal = signal(false);
  formMode = signal<'create' | 'edit' | 'view'>('create');
  selectedRecord = signal<ISaleRecordDto | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  isLoading = this.loadingService.isLoading;
  viewMode = signal<ViewMode>('charts');
  readonly viewOptions: ViewModeOption[] = [
    { id: 'charts', label: 'Analytics', icon: '📊' },
    { id: 'table', label: 'Data', icon: '📋' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];
  showStyleName = signal<boolean>(true);

  // Database connectivity
  isDatabaseHealthy = this.healthService.isHealthy;

  // Multi-store upload
  showStoreModal = signal<boolean>(false);
  pendingFile: File | null = null;
  pendingFileName = computed(() => this.pendingFile?.name || '');

  // Custom Excel mapping
  showCustomModal = signal<boolean>(false);
  private customMapping = inject(CustomExcelMappingService);

  // Data presence
  tableRows = signal<ISaleRecordDto[]>([]);
  analyticsReady = signal(false);
  analyticsLoading = signal(false);
  private tablePage = signal(1);
  readonly tableCurrentPage = this.tablePage.asReadonly();
  tableSelectionReset = signal(0);
  private readonly tablePageSize = 20;

  /**
   * Historical rows fetched from Supabase (RPC aggregates or full YoY-scoped
   * fetch). Kept separate from the local pending session so the two can be
   * merged for display without the server data overwriting unsaved edits.
   */
  private serverHistoricalRows = signal<ISaleRecordDto[]>([]);

  /**
   * True after a successful "Export to DB" while the analytics MV is still
   * refreshing. During this window the session holds the just-persisted rows
   * (isLocal = false) so KPIs compute client-side and reflect the new data
   * immediately. Cleared once the MV refresh confirms the data is aggregated.
   */
  private pendingSyncWithAnalytics = signal(false);

  hasLocalData = computed(() => this.salesProcessor.getSalesData().some((r: ISaleRecordDto & { isLocal?: boolean }) => r.isLocal));
  dataSourceCounts = computed(() =>
    resolveReportDataSourceCounts({
      hasLocalSession: this.hasLocalData(),
      sessionRows: this.salesProcessor.getSalesData(),
      databaseTotal: this.totalRecords(),
    })
  );
  hasData = computed(() => this.totalRecords() > 0 || this.salesProcessor.getSalesData().length > 0);
  initialDataReady = signal(false);
  showUpload = computed(() => this.initialDataReady() && !this.hasData());

  // ── Filters ──────────────────────────────────────────────────────────────────
  accountFilter = signal<string[]>([]);
  searchFilter = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  monthsFilter = signal<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  // Extracted signals for children
  filteredData = this.salesProcessor.filteredData;
  salesData = computed(() => this.salesProcessor.getSalesData());
  salesFilters = computed(() => this.salesProcessor.getFilters());

  totalRevenue = this.salesProcessor.totalRevenue;
  totalUnitsSold = this.salesProcessor.totalUnitsSold;

  revenueTrend = computed(() =>
    this.serverKpis()?.revenueTrend ?? this.salesProcessor.revenueTrend()
  );
  unitsTrend = computed(() => this.serverKpis()?.unitsTrend ?? this.salesProcessor.unitsTrend());
  yearRevenueComparison = computed(() =>
    this.serverKpis()?.yearRevenueComparison ?? this.salesProcessor.yearRevenueComparison()
  );
  yearUnitsComparison = computed(() =>
    this.serverKpis()?.yearUnitsComparison ?? this.salesProcessor.yearUnitsComparison()
  );

  insightsReport = this.salesInsightsService.insightsReport;

  totalRecords = signal<number>(0);
  availableAccounts = computed<string[]>(() => {
    if (this.useServerAnalytics() && this.serverAvailableAccounts().length) {
      return this.serverAvailableAccounts();
    }
    return [...new Set(this.salesProcessor.getSalesData().map(r => r.account).filter(Boolean))].sort();
  });

  /** Rows shown in sales-table after applying global filters. */
  tableFilteredRows = computed(() => {
    if (this.hasLocalData() || this.pendingSyncWithAnalytics()) {
      // During a pending sync (just exported), session rows are isLocal=false but
      // still held in memory so they remain visible while the MV refreshes.
      const local = this.hasLocalData()
        ? this.salesProcessor.getLocalPendingData()
        : this.salesProcessor.getSalesData();
      const merged = mergeLocalAndServer(local, this.serverHistoricalRows(), salesRecordBusinessKey);
      return filterSaleRecords(merged, this.salesFilters());
    }
    if (this.tableUseServerSide()) {
      return this.tableRows();
    }
    if (this.analyticsReady()) {
      return this.filteredData();
    }
    return filterSaleRecords(this.tableRows(), this.salesFilters());
  });

  tableUseServerSide = computed(
    () =>
      this.isDatabaseHealthy() &&
      !this.hasLocalData() &&
      !this.pendingSyncWithAnalytics() &&
      (this.viewMode() === 'table' || !this.analyticsReady())
  );

  tableDisplayTotal = computed(() =>
    this.tableUseServerSide() ? this.totalRecords() : this.tableFilteredRows().length
  );

  constructor() {
    effect(() => {
      const startDateValue = this.startDate();
      const endDateValue = this.endDate();

      this.salesProcessor.setFilters({
        account: this.accountFilter(),
        search: this.searchFilter(),
        startDate: startDateValue ? DateUtils.parseIsoDate(startDateValue) : null,
        endDate: endDateValue ? DateUtils.parseIsoDate(endDateValue) : null,
        months: this.monthsFilter(),
      });
    });

    effect(() => {
      if (!this.useServerAnalytics() || !this.analyticsReady() || this.hasLocalData()) return;
      const key = JSON.stringify({
        account: this.accountFilter(),
        search: this.searchFilter(),
        start: this.startDate(),
        end: this.endDate(),
        months: this.monthsFilter(),
      });
      if (!this.lastServerFilterKey) {
        this.lastServerFilterKey = key;
        return;
      }
      if (key === this.lastServerFilterKey) return;
      this.lastServerFilterKey = key;
      this.scheduleServerAnalyticsReload();
    });

    effect(() => {
      if (!this.initialDataReady() || this.hasLocalData() || !this.isDatabaseHealthy()) return;
      const key = salesTableFiltersCacheKey(this.salesFilters());
      if (!this.lastTableFilterKey) {
        this.lastTableFilterKey = key;
        return;
      }
      if (key === this.lastTableFilterKey) return;
      this.lastTableFilterKey = key;
      this.tableSelectionReset.update(n => n + 1);
      void this.fetchPaginatedSales(1, this.tablePageSize);
    });
  }

  ngOnInit(): void {
    void this.loadInitialSales();
  }

  /**
   * Fast path: first table page (20 rows) + total count.
   * Analytics load on demand when Charts/Insights is active (YoY-scoped Supabase fetch).
   */
  async loadInitialSales(): Promise<void> {
    await this.appStartup.whenReady();
    await this.healthService.whenReady();
    await this.authService.whenReady();

    const existing = this.salesProcessor.getSalesData();
    if (this.hasLocalData()) {
      this.totalRecords.set(existing.length);
      this.analyticsReady.set(true);
      this.initialDataReady.set(true);
      return;
    }

    try {
      await this.fetchPaginatedSales(1, this.tablePageSize);
      void this.ensureAnalyticsLoaded();
    } catch (err: unknown) {
      this.logError('loadInitialSales', 'Request failed', err);
      this.alertService.databaseConnectionFailed();
      this.initialDataReady.set(true);
    }
  }

  async fetchPaginatedSales(page: number, limit: number): Promise<void> {
    if (this.hasLocalData()) {
      this.initialDataReady.set(true);
      return;
    }

    this.tablePage.set(page);

    try {
      const res = await this.salesApi.getPaginatedForTable(page, limit, this.salesFilters());
      const isSuccess = res.success || res.statusCode === 200;
      if (isSuccess && res.data) {
        this.tableRows.set(this.normalizeTableRows(res.data));
        this.totalRecords.set(res.meta?.totalItems ?? res.data.length);
      } else {
        this.logError('fetchPaginatedSales', 'API returned an error state', res);
      }
    } catch (err: unknown) {
      this.logError('fetchPaginatedSales', 'Request failed', err);
      this.alertService.databaseConnectionFailed();
    } finally {
      this.initialDataReady.set(true);
    }
  }

  private ensureAnalyticsLoaded(): void {
    if (!ANALYTICS_VIEWS.has(this.viewMode()) || this.analyticsReady() || this.hasLocalData()) {
      return;
    }
    void this.loadAnalyticsInBackground();
  }

  private scheduleServerAnalyticsReload(): void {
    const generation = ++this.analyticsFetchGeneration;
    void this.loadAnalyticsFromServer(generation);
  }

  private applySalesServerBundle(bundle: NonNullable<Awaited<ReturnType<ReportAnalyticsApiService['fetchSalesAnalytics']>>>): void {
    const account = this.salesProcessor.getFilters().account;
    const revenueScope =
      account?.length === 1 ? `${account[0].toUpperCase()} REVENUE` : 'REVENUE';
    const unitsScope = account?.length === 1 ? `${account[0].toUpperCase()} UNITS` : 'UNITS';

    this.serverKpis.set({
      revenueTrend: mapRpcTotalsToYoyKpi(bundle.kpis.revenue_trend, true),
      unitsTrend: mapRpcTotalsToYoyKpi(bundle.kpis.units_trend, true),
      yearRevenueComparison: mapRpcTotalsToYearComparison(bundle.kpis.year_revenue, revenueScope, true),
      yearUnitsComparison: mapRpcTotalsToYearComparison(bundle.kpis.year_units, unitsScope, true),
    });
    this.serverAvailableAccounts.set(bundle.available_accounts ?? []);
    this.salesProcessor.setSalesData(salesAggregatesToRecords(bundle.monthly ?? []));
    this.useServerAnalytics.set(true);
    this.lastServerFilterKey = '';
    this.analyticsReady.set(true);
  }

  private async loadAnalyticsFromServer(expectedGeneration?: number): Promise<void> {
    if (this.hasLocalData()) return;

    const isInitial = expectedGeneration === undefined;
    if (isInitial && (this.analyticsLoading() || this.analyticsReady())) return;
    if (!isInitial && expectedGeneration !== this.analyticsFetchGeneration) return;

    if (isInitial) {
      this.analyticsLoading.set(true);
    }

    try {
      const bundle = await this.reportAnalytics.fetchSalesAnalytics(this.salesProcessor.getFilters());
      if (expectedGeneration !== undefined && expectedGeneration !== this.analyticsFetchGeneration) {
        return;
      }

      if (bundle) {
        this.applySalesServerBundle(bundle);
        return;
      }

      this.useServerAnalytics.set(false);
      this.serverKpis.set(null);

      const total = this.totalRecords();
      if (total <= SALES_ANALYTICS_CLIENT_FALLBACK_MAX_ROWS) {
        const rows = await this.salesApi.fetchAllForAnalytics();
        const serverRows = rows.map(row => ({ ...row, isLocal: false }));
        this.serverHistoricalRows.set(serverRows);
        this.salesProcessor.setSalesData(serverRows);
        this.analyticsReady.set(true);
        return;
      }

      this.analyticsReady.set(true);
      this.alertService.warning(
        'Analytics unavailable',
        'Could not load sales analytics from the database.'
      );
    } catch (err: unknown) {
      this.logError('loadAnalyticsFromServer', 'Request failed', err);
      this.alertService.databaseConnectionFailed();
      this.analyticsReady.set(true);
    } finally {
      if (isInitial) {
        this.analyticsLoading.set(false);
      }
    }
  }

  private async loadAnalyticsInBackground(): Promise<void> {
    if (!ANALYTICS_VIEWS.has(this.viewMode()) || this.analyticsReady() || this.hasLocalData()) {
      return;
    }
    await this.loadAnalyticsFromServer();
  }

  private async refreshAfterMutation(options?: { skipMvRefresh?: boolean }): Promise<void> {
    this.sessionCache.invalidateReport('sales');
    this.salesApi.clearPaginatedTableState();
    this.useServerAnalytics.set(false);
    this.serverKpis.set(null);
    this.serverHistoricalRows.set([]);
    this.lastServerFilterKey = '';
    this.lastTableFilterKey = '';
    this.analyticsFetchGeneration++;

    await this.fetchPaginatedSales(this.tablePage(), this.tablePageSize);
    this.tableSelectionReset.update(n => n + 1);

    // When a sync is pending (just exported), keep the session data visible and
    // compute KPIs client-side. Do NOT load the stale RPC yet — that would
    // overwrite the just-uploaded data with a pre-refresh snapshot.
    if (this.pendingSyncWithAnalytics()) {
      this.analyticsReady.set(true);
      this.scheduleSalesAnalyticsMvRefresh();
      return;
    }

    this.analyticsReady.set(false);
    if (!this.hasLocalData()) {
      if (!options?.skipMvRefresh) {
        this.scheduleSalesAnalyticsMvRefresh();
      }
      await this.loadAnalyticsFromServer();
    }
  }

  /**
   * Refreshes the sales analytics MV in the background, then reloads KPIs.
   *
   * Strategy (scalable — never pulls 150k+ raw rows to the browser):
   * 1. When a sync is pending, KPIs already compute client-side over the session
   *    (which includes the just-persisted rows), so charts reflect new data
   *    immediately without waiting for the MV.
   * 2. This refreshes the MV in the background (~30s on large datasets).
   * 3. On success: clears the session (no longer needed) and loads the fresh RPC
   *    so KPIs switch to the server-aggregated source.
   * 4. On failure: the session stays (client-side KPIs keep working) and we warn
   *    the user that the server snapshot may lag until the next refresh.
   */
  private scheduleSalesAnalyticsMvRefresh(): void {
    const generation = this.analyticsFetchGeneration;
    const wasPendingSync = this.pendingSyncWithAnalytics();
    void this.reportAnalytics.refreshSalesAnalyticsViewInBackground(true).then(refreshed => {
      if (generation !== this.analyticsFetchGeneration) return;
      this.sessionCache.invalidateReport('sales');
      if (refreshed) {
        // MV now includes the uploaded data — safe to clear the session and
        // switch to the server-aggregated RPC.
        if (wasPendingSync) {
          this.pendingSyncWithAnalytics.set(false);
          this.salesProcessor.setSalesData([]);
        }
        void this.loadAnalyticsFromServer(this.analyticsFetchGeneration);
      } else if (wasPendingSync) {
        // MV refresh failed — keep the session so KPIs stay accurate client-side.
        this.alertService.warning(
          'Analytics sync pending',
          'Your data was saved to the database. Charts show the current session and will sync with the server snapshot after the next analytics refresh.'
        );
      } else {
        this.alertService.warning(
          'Analytics refresh pending',
          'Sales charts show the last synchronized snapshot. Newly uploaded data will appear after the next analytics refresh.'
        );
      }
    });
  }

  private normalizeTableRows(rows: ISaleRecordDto[]): ISaleRecordDto[] {
    return rows.map(row => this.salesCuration.curateRecord(row, { preserveIsLocal: true }));
  }

  handleTableAction(event: { action: string; row: unknown }): void {
    const row = event.row as ISaleRecordDto;
    this.selectedRecord.set(row);
    if (event.action === 'edit') {
      if (!this.rolePermissions.can('edit')) {
        this.alertService.error('Access denied', 'You do not have permission to edit records.');
        return;
      }
      this.formMode.set('edit');
      this.showRecordModal.set(true);
    } else if (event.action === 'delete') {
      if (!this.rolePermissions.can('delete')) {
        this.alertService.error('Access denied', 'You do not have permission to delete records.');
        return;
      }
      void this.confirmDelete(row);
    } else if (event.action === 'view') {
      this.formMode.set('view');
      this.showRecordModal.set(true);
    }
  }

  handleBulkTableAction(event: { action: string; rows: unknown[] }): void {
    if (event.action !== 'bulkDelete') return;
    if (!this.rolePermissions.can('delete')) {
      this.alertService.error('Access denied', 'You do not have permission to delete records.');
      return;
    }
    void this.confirmBulkDelete(event.rows as ISaleRecordDto[]);
  }

  openCreateForm(): void {
    if (!this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to create records.');
      return;
    }
    this.selectedRecord.set(null);
    this.formMode.set('create');
    this.showRecordModal.set(true);
  }

  async confirmDelete(row: ISaleRecordDto) {
    const result = await this.alertService.confirm('Are you sure?', `Delete order ${row.orderId}?`);
    if (result.isConfirmed) {
      try {
        await this.salesApi.remove(row.id);
        this.alertService.success('Deleted', 'Record removed successfully.');
        this.tableSelectionReset.update(n => n + 1);
        await this.refreshAfterMutation();
      } catch (err) {
        this.alertService.error('Error', 'Could not delete record from database.');
      }
    }
  }

  async confirmBulkDelete(rows: ISaleRecordDto[]): Promise<void> {
    const removed = await confirmAndRemoveBatch({
      rows,
      alertService: this.alertService,
      confirmTitle: 'Delete selected records?',
      confirmMessage: count =>
        `This will permanently remove ${count} sale record${count === 1 ? '' : 's'}.`,
      remove: id => this.salesApi.remove(id),
      successMessage: (deletedRows: any[]) =>
        `${deletedRows.length} sale record${deletedRows.length === 1 ? '' : 's'} removed successfully: ${deletedRows.map(r => r.orderId || r.id).join(', ')}.`,
    });

    if (removed) {
      this.tableSelectionReset.update(n => n + 1);
      await this.refreshAfterMutation();
    }
  }

  async onFormSave(data: Partial<ISaleRecordDto>): Promise<void> {
    const mode = this.formMode();
    if (mode === 'view') {
      this.showRecordModal.set(false);
      return;
    }
    if (mode === 'create' && !this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to create records.');
      return;
    }
    if (mode === 'edit' && !this.rolePermissions.can('edit')) {
      this.alertService.error('Access denied', 'You do not have permission to edit records.');
      return;
    }
    try {
      if (mode === 'create') {
        await this.salesApi.create(data as ISaleRecordDto);
        this.alertService.success('Created', 'New sale record created.');
      } else {
        const id = data.id ?? this.selectedRecord()?.id;
        if (!id) {
          this.alertService.error('Error', 'Cannot update — record id is missing.');
          return;
        }
        await this.salesApi.update(id, { ...data, id } as ISaleRecordDto);
        this.alertService.success('Updated', 'Record updated successfully.');
      }
      this.showRecordModal.set(false);
      await this.refreshAfterMutation();
    } catch (err) {
      this.alertService.error('Error', 'Could not save record to database.');
    }
  }

  private logError(context: string, message: string, detail?: any) {
    const timestamp = DateUtils.now().toISOString();
    console.error(`[SalesReportComponent][${timestamp}][${context}] ${message}`, detail || '');
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.pendingFile = file;
      this.showStoreModal.set(true);
    }
    event.target.value = '';
  }

  async confirmUpload(storeType: StoreType) {
    if (!this.pendingFile) return;
    this.showStoreModal.set(false);

    // Custom Excel: hand off to the visual mapping modal instead of a fixed parser.
    if (storeType === 'custom-excel') {
      this.loadingService.begin('Loading mapping templates…');
      try {
        await this.customMapping.loadTemplates();
        this.showCustomModal.set(true);
      } catch (err: any) {
        this.logError('confirmUpload', 'Failed to load mapping templates', err);
        this.alertService.error('Template load error', err?.message ?? 'Could not load saved templates.');
        this.pendingFile = null;
      } finally {
        this.loadingService.end();
      }
      return;
    }

    this.loadingService.begin('Processing sales file…');

    try {
      let newRecords: ISaleRecordDto[] = [];

      const rawData = await this.excelHandler.parseExcelFile(this.pendingFile);

      const records = this.fileHandler.processFile(storeType, rawData);
      newRecords = records.map(r => ({ ...r, isLocal: true }));

      this.clearFilters();
      this.salesProcessor.addSalesData(newRecords);
      this.activateLocalSessionAfterImport();

      this.alertService.success(
        'Upload Complete',
        `Successfully loaded ${newRecords.length} records from ${storeType}. Remember to Export to DB.`
      );
    } catch (err: any) {
      this.logError('confirmUpload', 'File processing failed', err);
      this.alertService.error('Upload Error', err?.message || 'Failed to process file.');
    } finally {
      this.loadingService.end();
      this.pendingFile = null;
    }
  }

  /** Receives the records produced by the custom mapping modal. */
  onCustomMappingConfirm(result: CustomMappingResult): Promise<void> {
    this.showCustomModal.set(false);
    this.pendingFile = null;

    if (!result.records.length) {
      this.alertService.warning('No records', 'The mapping produced no valid sales records.');
      return Promise.resolve();
    }

    const newRecords = result.records.map(r => ({ ...r, isLocal: true }));
    this.clearFilters();
    this.salesProcessor.addSalesData(newRecords);
    this.activateLocalSessionAfterImport();

    this.alertService.success(
      'Custom Upload Complete',
      `Successfully loaded ${newRecords.length} records from ${result.template.accountName}. Remember to Export to DB.`
    );
    return Promise.resolve();
  }

  onCustomMappingCancel(): void {
    this.showCustomModal.set(false);
    this.pendingFile = null;
  }

  cancelUpload() {
    this.showStoreModal.set(false);
    this.pendingFile = null;
  }

  setViewMode(mode: string) {
    this.viewMode.set(mode as ViewMode);
    void this.ensureAnalyticsLoaded();
  }

  async exportTableToExcel(): Promise<void> {
    if (this.hasLocalData()) {
      this.dataExport.exportSalesSessionToExcel();
      return;
    }

    await this.dataExport.exportFromDatabase({
      fetch: () =>
        this.salesApi.fetchAllCuratedForExport().then(res =>
          res.map(r => ({ ...r } as Record<string, unknown>))
        ),
      sheetName: 'Sales',
      filePrefix: 'auratech_sales_export',
      entityLabel: 'sales records',
    });
  }

  downloadJson(eventData?: any[]) {
    const data = eventData && eventData.length > 0 ? eventData : this.filteredData();
    if (data.length === 0) {
      this.alertService.error('Export Error', 'No filtered sales data available to export to JSON.');
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auratech_sales_export_${DateUtils.formatToDateString(DateUtils.now())}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    this.alertService.success('JSON Ready', 'Your sales data has been generated as a JSON file.');
  }

  async exportToDatabase() {
    const raw = this.salesProcessor.getLocalPendingData();
    const curated = this.salesCuration.curateForUpload(raw);
    const skipped = raw.length - curated.length;

    if (!curated.length) {
      this.alertService.warning(
        'Export blocked',
        raw.length
          ? 'All session rows were filtered out as duplicates or invalid.'
          : 'There are no new session sales records to export.'
      );
      return;
    }

    const exported = await this.bulkSync.exportLocalRecords({
      records: curated,
      upload: rows => this.salesApi.bulkUpload(rows),
      entityLabel: 'sales records',
      emptyMessage: 'There are no new session sales records to export.',
      successMessage: uploaded =>
        `Exported ${uploaded} new sales record${uploaded === 1 ? '' : 's'} to the database. Charts will update shortly.`,
      onSuccess: async () => {
        // Keep the uploaded rows visible (mark as persisted, do NOT clear the session)
        // so the user still sees their data while the analytics MV refreshes in the
        // background. KPIs compute client-side over the session during this window.
        // The session is cleared once the MV refresh confirms the data is aggregated.
        this.salesProcessor.markLocalAsPersisted();
        this.pendingSyncWithAnalytics.set(true);
        await this.refreshAfterMutation();
      },
    });

    if (!exported) return;

    if (skipped > 0) {
      console.warn(`[SalesReport] Export skipped ${skipped} duplicate/invalid rows after curation.`);
      this.alertService.info(
        'Partial session export',
        `${skipped} duplicate or invalid row(s) were not sent to the database.`
      );
    }
  }

  /** Switches KPIs/charts to the in-memory session instead of stale server RPC data. */
  private activateLocalSessionAfterImport(): void {
    this.useServerAnalytics.set(false);
    this.serverKpis.set(null);
    this.lastServerFilterKey = '';
    this.analyticsFetchGeneration++;
    this.analyticsReady.set(true);
    this.totalRecords.set(this.salesProcessor.getLocalPendingData().length);
  }

  clearFilters() {
    this.accountFilter.set([]);
    this.searchFilter.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.monthsFilter.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  }

  resetData() {
    this.salesProcessor.setSalesData([]);
    this.viewMode.set('charts');
    this.clearFilters();
  }
}