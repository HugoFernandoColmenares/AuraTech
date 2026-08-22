import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService, InventoryAccount } from '@core/services/Excel/inventory.service';
import { TableColumn } from '@shared/components/data-table/data-table.component';
import { InsightsReportComponent } from '@shared/components/insights/insights-report.component';
import { AlertService } from '@core/services/Utils/alert.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { ViewMode } from '@core/interfaces/chart.interface';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { InventoryRecordsApiService } from '@core/services/api/inventory-records-api.service';
import { getInventoryInsights } from '@core/auxiliar/inventory-insights.helper';
import { buildRowViews } from '@core/auxiliar/inventory.helper';
import { InventoryTableComponent } from './components/inventory-table/inventory-table.component';
import { InventoryAnalyticsComponent } from './components/inventory-analytics/inventory-analytics.component';
import { InventoryModalComponent } from './components/inventory-modal/inventory-modal.component';
import { ViewControlsComponent } from '@shared/components/view-controls/view-controls.component';
import { ReportUploadPlaceholderComponent } from '@shared/components/report-upload-placeholder/report-upload-placeholder.component';
import { ViewModeOption } from '@core/interfaces/view-controls.interface';
import { DataExportService } from '@core/services/Utils/data-export.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { ReportSessionCacheService } from '@core/services/Utils/report-session-cache.service';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { ReportAnalyticsApiService } from '@core/services/api/report-analytics-api.service';
import { InventoryAnalyticsRpcResponse } from '@core/interfaces/report-analytics-rpc.interface';
import { IInventoryRecordDto } from '@core/interfaces/IInventoryRecordDto.interface';
import { confirmAndRemoveBatch } from '@core/auxiliar/batch-record-delete.util';
import { resolveReportDataSourceCounts } from '@core/auxiliar/data-source-count.util';
import { mergeLocalAndServer } from '@core/auxiliar/local-server-merge.util';

const ANALYTICS_VIEWS = new Set<ViewMode>(['charts', 'insights']);

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InsightsReportComponent,
    MainTableFilterComponent,
    InventoryTableComponent,
    InventoryAnalyticsComponent,
    InventoryModalComponent,
    ViewControlsComponent,
    ReportUploadPlaceholderComponent,
  ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private alertService = inject(AlertService);
  private dataExport = inject(DataExportService);
  private loadingService = inject(LoadingService);
  private inventoryApi = inject(InventoryRecordsApiService);
  private healthService = inject(HealthService);
  private bulkSync = inject(BulkSyncService);
  private sessionCache = inject(ReportSessionCacheService);
  private authService = inject(AuthService);
  private rolePermissions = inject(RolePermissionService);
  private appStartup = inject(AppStartupService);
  private reportAnalytics = inject(ReportAnalyticsApiService);

  isLoading = this.loadingService.isLoading;
  initialDataReady = signal(false);
  tableSelectionReset = signal(0);
  analyticsReady = signal(false);
  analyticsLoading = signal(false);
  inventoryServerAnalytics = signal<InventoryAnalyticsRpcResponse | null>(null);
  analyticsExcludeZeroAvailable = signal(true);
  analyticsExcludeZeroOnHand = signal(true);

  showStoreModal = signal(false);
  pendingFile: File | null = null;
  selectedAccount = signal<InventoryAccount>('Inventory Dashboard');
  viewMode = signal<ViewMode>('charts');

  /** Historical server rows kept separate from the local pending session. */
  private serverHistoricalRows = signal<IInventoryRecordDto[]>([]);
  readonly viewOptions: ViewModeOption[] = [
    { id: 'charts', label: 'Analytics', icon: '📊' },
    { id: 'table', label: 'Table', icon: '📋' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];
  isSkuSplit = signal(false);
  totalRecords = signal(0);

  showRecordModal = signal(false);
  formMode = signal<'view' | 'edit' | 'create'>('view');
  selectedRecord = signal<IInventoryRecordDto | null>(null);

  private tablePage = signal(1);
  private readonly tablePageSize = 20;
  tableRows = signal<IInventoryRecordDto[]>([]);

  hasLocalData = computed(() =>
    this.inventoryService.inventoryData().some(r => r.isLocal)
  );
  dataSourceCounts = computed(() =>
    resolveReportDataSourceCounts({
      hasLocalSession: this.hasLocalData(),
      sessionRows: this.inventoryService.inventoryData(),
      databaseTotal: this.totalRecords(),
    })
  );
  hasData = computed(
    () => this.totalRecords() > 0 || this.inventoryService.inventoryData().length > 0
  );
  showUpload = computed(() => this.initialDataReady() && !this.hasData());

  tableUseServerSide = computed(
    () =>
      this.healthService.isHealthy() &&
      !this.hasLocalData() &&
      (this.viewMode() === 'table' || !this.analyticsReady())
  );

  private dataSource = computed(() => {
    if (this.hasLocalData()) {
      // Merge pending local rows with the server history so the table/analytics
      // show the full picture. Local rows win on sku + sourceFile collisions.
      return mergeLocalAndServer(
        this.inventoryService.getLocalPendingData(),
        this.serverHistoricalRows(),
        r => `${r.sku}|${r.sourceFile}`
      );
    }
    if (this.viewMode() === 'table' || !this.analyticsReady()) {
      return this.tableRows();
    }
    return this.inventoryService.inventoryData();
  });

  searchFilter = signal('');
  divisionFilter = signal('');
  typeFilter = signal('');
  statusFilter = signal('');

  columns = computed<TableColumn[]>(() => {
    const cols: TableColumn[] = [{ key: 'status', label: 'Status', type: 'badge' }];

    if (!this.isSkuSplit()) {
      cols.push({ key: 'sku', label: 'SKU', cssClass: 'mono' });
    } else {
      cols.push({ key: 'family', label: 'Family', cssClass: 'mono' });
      cols.push({ key: 'color', label: 'Color', cssClass: 'mono' });
      cols.push({ key: 'size', label: 'Size', cssClass: 'mono' });
    }

    cols.push(
      { key: 'available', label: 'Available', type: 'badge', cssClass: 'text-center' },
      { key: 'onHand', label: 'On Hand', type: 'number', cssClass: 'text-center' },
      { key: 'type', label: 'Type' },
      { key: 'division', label: 'Division' },
      { key: 'collection', label: 'Collection' },
      { key: 'sourceFile', label: 'Source' },
      { key: 'actions', label: 'Actions', type: 'action', cssClass: 'text-center' }
    );

    return cols;
  });

  allRowViews = computed(() =>
    buildRowViews(
      this.dataSource(),
      this.isSkuSplit(),
      this.inventoryService.URGENT_THRESHOLD,
      this.inventoryService.PRIORITY_THRESHOLD
    )
  );

  filteredData = computed(() => {
    let data = this.allRowViews();
    const search = this.searchFilter().toLowerCase();
    const division = this.divisionFilter();
    const type = this.typeFilter();
    const status = this.statusFilter();

    if (division) data = data.filter(d => d.division === division);
    if (type) data = data.filter(d => d.type === type);
    if (status) data = data.filter(d => d.status === status);

    if (search) {
      data = data.filter(
        d =>
          d.sku.toLowerCase().includes(search) ||
          d.productName.toLowerCase().includes(search) ||
          d.sourceFile.toLowerCase().includes(search)
      );
    }
    return data;
  });

  tableDisplayRows = computed(() =>
    this.tableUseServerSide()
      ? buildRowViews(
          this.tableRows(),
          this.isSkuSplit(),
          this.inventoryService.URGENT_THRESHOLD,
          this.inventoryService.PRIORITY_THRESHOLD
        )
      : this.filteredData()
  );

  availableDivisions = computed(() =>
    [...new Set(this.allRowViews().map(d => d.division))].sort()
  );
  availableTypes = computed(() =>
    [...new Set(this.dataSource().map(d => d.type))].sort()
  );
  availableStatuses = ['Urgent', 'Priority', 'Good'];

  totalUnits = computed(() => {
    const server = this.inventoryServerAnalytics();
    if (server && !this.hasLocalData()) return server.kpis.total_available;
    // When local data is present, reduce over the merged local+server dataset.
    return this.dataSource().reduce((sum, d) => sum + d.available, 0);
  });
  totalOnHand = computed(() => {
    const server = this.inventoryServerAnalytics();
    if (server && !this.hasLocalData()) return server.kpis.total_on_hand;
    return this.dataSource().reduce((sum, d) => sum + d.onHand, 0);
  });
  inventoryInsights = getInventoryInsights(this.dataSource);

  @ViewChild('inventoryFileInput') inventoryFileInput!: ElementRef<HTMLInputElement>;

  triggerFileInput(): void {
    this.inventoryFileInput.nativeElement.click();
  }

  ngOnInit(): void {
    void this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    await this.appStartup.whenReady();
    await this.healthService.whenReady();
    await this.authService.whenReady();

    if (this.hasLocalData() || this.inventoryService.inventoryData().length > 0) {
      this.totalRecords.set(this.inventoryService.inventoryData().length);
      this.analyticsReady.set(true);
      this.initialDataReady.set(true);
      return;
    }

    try {
      await this.fetchPaginatedInventory(1, this.tablePageSize);
      void this.ensureAnalyticsLoaded();
    } catch (err: unknown) {
      console.error('[Inventory] loadInitialData failed:', err);
      this.alertService.error('Connection Error', 'Could not retrieve inventory data.');
      this.initialDataReady.set(true);
    }
  }

  private async fetchPaginatedInventory(page: number, limit: number): Promise<void> {
    if (this.hasLocalData()) {
      this.initialDataReady.set(true);
      return;
    }

    const res = await this.inventoryApi.getPaginated(page, limit);
    const isSuccess = res.success || res.statusCode === 200;
    if (isSuccess && res.data) {
      this.tablePage.set(page);
      this.tableRows.set(res.data);
      this.totalRecords.set(res.meta?.totalItems ?? res.data.length);
    }
    this.initialDataReady.set(true);
  }

  private ensureAnalyticsLoaded(): void {
    if (!ANALYTICS_VIEWS.has(this.viewMode()) || this.analyticsReady() || this.hasLocalData()) {
      return;
    }
    void this.loadAnalyticsInBackground();
  }

  private async loadAnalyticsInBackground(): Promise<void> {
    // When a local session is active, load historical server rows in the
    // background so the table/analytics can merge local + server data. This runs
    // independently of analyticsReady (which is already true for local sessions).
    if (this.hasLocalData()) {
      if (this.serverHistoricalRows().length > 0) return;
      try {
        const rows = await this.inventoryApi.fetchAllForAnalytics();
        this.serverHistoricalRows.set(rows.map(r => ({ ...r, isLocal: false })));
      } catch (err: unknown) {
        console.error('[Inventory] loadServerHistoryForLocalSession failed:', err);
      }
      return;
    }

    if (this.analyticsLoading() || this.analyticsReady()) {
      return;
    }

    this.analyticsLoading.set(true);
    try {
      const bundle = await this.reportAnalytics.fetchInventoryAnalytics({
        search: this.searchFilter(),
        division: this.divisionFilter(),
        type: this.typeFilter(),
        excludeZeroAvailable: this.analyticsExcludeZeroAvailable(),
        excludeZeroOnHand: this.analyticsExcludeZeroOnHand(),
      });

      if (bundle) {
        this.inventoryServerAnalytics.set(bundle);
        this.analyticsReady.set(true);
        return;
      }

      const rows = await this.inventoryApi.fetchAllForAnalytics();
      this.serverHistoricalRows.set(rows.map(r => ({ ...r, isLocal: false })));
      this.inventoryService.setInventoryData(rows);
      this.analyticsReady.set(true);
    } catch (err: unknown) {
      console.error('[Inventory] loadAnalytics failed:', err);
      this.alertService.databaseConnectionFailed();
    } finally {
      this.analyticsLoading.set(false);
    }
  }

  onAnalyticsFiltersChange(filters: {
    excludeZeroAvailable: boolean;
    excludeZeroOnHand: boolean;
  }): void {
    this.analyticsExcludeZeroAvailable.set(filters.excludeZeroAvailable);
    this.analyticsExcludeZeroOnHand.set(filters.excludeZeroOnHand);
    if (this.hasLocalData()) return;
    this.analyticsReady.set(false);
    this.inventoryServerAnalytics.set(null);
    void this.loadAnalyticsInBackground();
  }

  onGlobalFiltersChanged(): void {
    if (this.hasLocalData()) return;
    this.analyticsReady.set(false);
    this.inventoryServerAnalytics.set(null);
    void this.ensureAnalyticsLoaded();
  }

  private async refreshAfterMutation(): Promise<void> {
    this.sessionCache.invalidateReport('inventory');
    this.analyticsReady.set(false);
    this.inventoryServerAnalytics.set(null);
    this.serverHistoricalRows.set([]);
    await this.fetchPaginatedInventory(this.tablePage(), this.tablePageSize);
    this.tableSelectionReset.update(n => n + 1);
    if (!this.hasLocalData()) {
      await this.loadAnalyticsInBackground();
    }
  }

  downloadJson(): void {
    this.dataExport.exportInventoryToJSON();
  }

  async exportTableToExcel(): Promise<void> {
    if (this.hasLocalData()) {
      this.dataExport.exportInventorySessionToExcel();
      return;
    }

    await this.dataExport.exportFromDatabase({
      fetch: () => this.inventoryApi.fetchAll(5000),
      sheetName: 'Inventory',
      filePrefix: 'ymi_inventory_export',
      entityLabel: 'inventory records',
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.pendingFile = file;
      this.showStoreModal.set(true);
    }
    (event.target as HTMLInputElement).value = '';
  }

  async confirmUpload(): Promise<void> {
    if (!this.pendingFile) return;

    this.showStoreModal.set(false);
    this.loadingService.begin('Processing inventory file…');

    try {
      const data = await this.inventoryService.parseExcelFile(
        this.pendingFile,
        this.selectedAccount()
      );
      this.inventoryService.addInventoryData(data);
      this.totalRecords.set(this.inventoryService.inventoryData().length);
      this.analyticsReady.set(true);
      this.initialDataReady.set(true);
      // Load server history in the background so the table shows local + historical rows.
      void this.loadAnalyticsInBackground();
      this.alertService.success(
        'Success',
        `Imported ${data.length} records from ${this.pendingFile.name}`
      );
    } catch (err: unknown) {
      console.error('[Inventory] Excel parse failed:', err);
      this.alertService.error('Error', 'Failed to parse Excel file');
    } finally {
      this.loadingService.end();
      this.pendingFile = null;
    }
  }

  showAlerts(): void {
    const server = this.inventoryServerAnalytics();
    const urgent = server && !this.hasLocalData()
      ? server.kpis.urgent_count
      : this.inventoryService.getUrgentCount();
    const priority = server && !this.hasLocalData()
      ? server.kpis.priority_count
      : this.inventoryService.getPriorityCount();
    this.alertService.inventoryAlert(
      server && !this.hasLocalData() ? server.kpis.sku_count : this.dataSource().length,
      this.totalUnits(),
      this.totalOnHand(),
      urgent,
      priority,
      this.inventoryService.URGENT_THRESHOLD,
      this.inventoryService.PRIORITY_THRESHOLD
    );
  }

  setViewMode(mode: string): void {
    this.viewMode.set(mode as ViewMode);
    void this.ensureAnalyticsLoaded();
  }

  resetData(): void {
    this.inventoryService.setInventoryData([]);
    this.tableRows.set([]);
    this.totalRecords.set(0);
    this.analyticsReady.set(false);
    this.inventoryServerAnalytics.set(null);
    this.viewMode.set('charts');
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

  handleTableAction(event: { action: string; row: IInventoryRecordDto }): void {
    this.selectedRecord.set(event.row);
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
      void this.confirmDelete(event.row);
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
    void this.confirmBulkDelete(event.rows as IInventoryRecordDto[]);
  }

  async confirmDelete(row: IInventoryRecordDto): Promise<void> {
    const result = await this.alertService.confirm(
      'Are you sure?',
      `Delete inventory record for SKU ${row.sku}?`
    );
    if (!result.isConfirmed) return;

    try {
      await this.inventoryApi.remove(row.id);
      this.alertService.success('Deleted', 'Record removed successfully.');
      this.tableSelectionReset.update(n => n + 1);
      await this.refreshAfterMutation();
    } catch (err: unknown) {
      console.error('[Inventory] delete failed:', err);
      this.alertService.error('Error', 'Could not delete record from database.');
    }
  }

  async confirmBulkDelete(rows: IInventoryRecordDto[]): Promise<void> {
    const removed = await confirmAndRemoveBatch({
      rows,
      alertService: this.alertService,
      confirmTitle: 'Delete selected records?',
      confirmMessage: count =>
        `This will permanently remove ${count} inventory record${count === 1 ? '' : 's'}.`,
      remove: id => this.inventoryApi.remove(id),
      successMessage: (deletedRows: any[]) =>
        `${deletedRows.length} inventory record${deletedRows.length === 1 ? '' : 's'} removed successfully: ${deletedRows.map(r => r.sku || r.id).join(', ')}.`,
    });

    if (removed) {
      this.tableSelectionReset.update(n => n + 1);
      await this.refreshAfterMutation();
    }
  }

  async onFormSave(data: IInventoryRecordDto): Promise<void> {
    const mode = this.formMode();
    if (mode === 'create' && !this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to create records.');
      return;
    }
    if (mode === 'edit' && !this.rolePermissions.can('edit')) {
      this.alertService.error('Access denied', 'You do not have permission to edit records.');
      return;
    }
    try {
      if (this.formMode() === 'create') {
        await this.inventoryApi.create(data);
        this.alertService.success('Created', 'New inventory record created.');
      } else {
        await this.inventoryApi.update(this.selectedRecord()!.id, data);
        this.alertService.success('Updated', 'Record updated successfully.');
      }
      this.showRecordModal.set(false);
      await this.refreshAfterMutation();
    } catch (err: unknown) {
      console.error('[Inventory] save failed:', err);
      this.alertService.error('Error', 'Failed to save changes.');
    }
  }

  async exportToDatabase(): Promise<void> {
    await this.bulkSync.exportLocalRecords({
      records: this.inventoryService.inventoryData().filter(r => r.isLocal),
      upload: rows => this.inventoryApi.bulkUpload(rows),
      entityLabel: 'inventory records',
      emptyMessage: 'There are no session inventory records to export.',
      onSuccess: () => this.refreshAfterMutation(),
    });
  }
}
