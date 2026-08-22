import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ExcelHandlerService } from '@core/services/Excel/excel-handler.service';
import {
  CustomExcelMappingService,
  SALE_MAPPING_FIELDS,
} from '@core/services/Excel/custom-excel-mapping.service';
import { AlertService } from '@core/services/Utils/alert.service';
import {
  IExcelMappingDto,
  ISaleRecordMappingProperties,
} from '@core/interfaces/IExcelMappingDto.interface';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';

/** Payload emitted when the user finishes mapping and confirms. */
export interface CustomMappingResult {
  records: ISaleRecordDto[];
  template: IExcelMappingDto;
  saveTemplate: boolean;
}

type Step = 1 | 2 | 3 | 4;

/**
 * Guides the user through uploading a custom Excel file, picking a worksheet,
 * visually mapping each {@link ISaleRecordDto} field to an Excel column, and
 * previewing the parsed records before confirming.
 */
@Component({
  selector: 'app-custom-mapping-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SelectModule, DatePickerModule],
  templateUrl: './custom-mapping-modal.component.html',
  styleUrl: './custom-mapping-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomMappingModalComponent implements OnInit {
  private readonly excelHandler = inject(ExcelHandlerService);
  private readonly mappingService = inject(CustomExcelMappingService);
  private readonly alerts = inject(AlertService);
  private readonly fb = inject(FormBuilder);

  readonly fields = SALE_MAPPING_FIELDS;

  readonly categoryOptions = [
    { label: 'Retail', value: 'Retail' as const },
    { label: 'Wholesale', value: 'Wholesale' as const },
  ];

  /** Pre-selected file (set by the parent before opening the modal). */
  pendingFile = input<File | null>(null);

  /** Emits the mapped records + template when the user confirms. */
  confirm = output<CustomMappingResult>();
  /** Emits when the user cancels. */
  cancel = output<void>();

  /** File chosen inside the modal; falls back to the parent-provided one. */
  readonly chosenFile = signal<File | null>(null);
  readonly activeFile = computed<File | null>(() => this.chosenFile() ?? this.pendingFile());

  readonly step = signal<Step>(1);
  readonly busy = signal(false);

  readonly sheetNames = signal<string[]>([]);
  readonly sheetOptions = computed(() =>
    this.sheetNames().map(name => ({ label: name, value: name }))
  );
  readonly selectedSheet = signal<string>('');
  readonly headers = signal<string[]>([]);
  private rows: Record<string, unknown>[] = [];

  readonly saveTemplate = signal(false);

  /** Manual audit period (applied to all rows when Excel has no month/year columns). */
  readonly auditMonthDate = signal<Date | null>(null);
  readonly auditYearDate = signal<Date | null>(null);

  /** Reactive form holding accountName / category / dateFormat. */
  readonly metaForm = this.fb.group({
    accountName: ['', [Validators.required]],
    category: ['Retail' as 'Retail' | 'Wholesale', [Validators.required]],
    dateFormat: [''],
  });

  /** One control per mappable field; value = the Excel column header. */
  readonly mappingForm = this.fb.group(
    SALE_MAPPING_FIELDS.reduce(
      (acc, field) => ({ ...acc, [field.key]: ['', field.optional ? [] : [Validators.required]] }),
      {} as Record<string, any>
    )
  );

  /** Tracks mapping form changes so validation reacts under OnPush. */
  private readonly mappingFormValue = toSignal(
    this.mappingForm.valueChanges.pipe(startWith(this.mappingForm.value)),
    { initialValue: this.mappingForm.value }
  );

  /** Saved templates available for quick load. */
  readonly savedTemplateOptions = computed(() =>
    this.mappingService.templateList().map(t => ({
      label: t.accountName,
      value: t.accountName,
    }))
  );

  /** Live validation: required fields + no duplicate column assignments. */
  readonly mappingErrors = computed<string[]>(() => {
    const value = this.mappingFormValue() as Partial<ISaleRecordMappingProperties>;
    return this.mappingService.validatePropertiesMap(value);
  });

  readonly canProceedToMapping = computed(
    () => !!this.selectedSheet() && this.headers().length > 0
  );
  readonly canPreview = computed(() => this.mappingErrors().length === 0);
  readonly previewRecords = signal<ISaleRecordDto[]>([]);
  /** Total valid rows after mapping (preview shows only the first few). */
  readonly totalMappedCount = signal(0);

  ngOnInit(): void {
    const file = this.pendingFile();
    if (file) {
      void this.bootstrapFromFile(file);
    }
  }

  /** Column options for a field, hiding columns already assigned elsewhere. */
  columnOptionsFor(fieldKey: keyof ISaleRecordMappingProperties): { label: string; value: string }[] {
    const current = this.mappingFormValue() as Partial<ISaleRecordMappingProperties>;
    const usedByOthers = new Set(
      SALE_MAPPING_FIELDS
        .filter(f => f.key !== fieldKey)
        .map(f => (current[f.key] ?? '').trim())
        .filter(Boolean)
    );
    return this.headers()
      .filter(h => !usedByOthers.has(h) || (current[fieldKey] ?? '').trim() === h)
      .map(h => ({ label: h, value: h }));
  }

  triggerFilePicker(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  async bootstrapFromFile(file: File): Promise<void> {
    this.busy.set(true);
    try {
      const names = await this.excelHandler.getSheetNames(file);
      if (!names.length) {
        this.alerts.error('No sheets', 'The Excel workbook has no readable sheets.');
        return;
      }
      this.chosenFile.set(file);
      this.sheetNames.set(names);
      this.selectedSheet.set(names[0]);
      this.step.set(2);
    } catch (err: any) {
      this.alerts.error('Read error', err?.message ?? 'Could not read the Excel file.');
    } finally {
      this.busy.set(false);
    }
  }

  async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.bootstrapFromFile(file);
  }

  async loadSheet(): Promise<void> {
    const file = this.activeFile();
    const sheet = this.selectedSheet();
    if (!file || !sheet) return;

    this.busy.set(true);
    try {
      const { headers, rows } = await this.excelHandler.parseCustomSheet(file, sheet);
      if (!rows.length) {
        this.alerts.warning('Empty sheet', `"${sheet}" has no data rows.`);
        return;
      }
      this.headers.set(headers);
      this.rows = rows;
      this.step.set(3);
      this.tryApplyTemplateForAccount(this.metaForm.get('accountName')?.value ?? '');
    } catch (err: any) {
      this.alerts.error('Sheet error', err?.message ?? 'Could not read the selected sheet.');
    } finally {
      this.busy.set(false);
    }
  }

  goToMapping(): void {
    if (this.canProceedToMapping()) this.step.set(3);
  }

  buildPreview(): void {
    if (!this.canPreview()) {
      this.alerts.warning('Incomplete mapping', 'Please fix the highlighted fields before previewing.');
      return;
    }
    const template = this.currentTemplate();
    const allRecords = this.mappingService.applyTemplate(this.rows, template);
    this.totalMappedCount.set(allRecords.length);
    this.previewRecords.set(allRecords.slice(0, 5));
    this.step.set(4);
  }

  onAccountNameBlur(): void {
    const name = (this.metaForm.get('accountName')?.value ?? '').trim();
    if (name) this.tryApplyTemplateForAccount(name);
  }

  onSavedTemplateSelected(accountName: string | null): void {
    if (!accountName) return;
    this.tryApplyTemplateForAccount(accountName);
  }

  onAuditMonthChange(value: Date | null): void {
    this.auditMonthDate.set(value);
  }

  onAuditYearChange(value: Date | null): void {
    this.auditYearDate.set(value);
  }

  private tryApplyTemplateForAccount(accountName: string): void {
    const saved = this.mappingService.getTemplate(accountName);
    if (!saved) return;
    this.applySavedTemplate(saved);
  }

  private applySavedTemplate(template: IExcelMappingDto): void {
    this.metaForm.patchValue({
      accountName: template.accountName,
      category: template.category,
      dateFormat: template.dateFormat ?? '',
    });

    if (this.sheetNames().includes(template.sheetName)) {
      this.selectedSheet.set(template.sheetName);
    }

    const patch = SALE_MAPPING_FIELDS.reduce(
      (acc, field) => ({
        ...acc,
        [field.key]: template.propertiesMap[field.key] ?? '',
      }),
      {} as Record<string, string>
    );
    this.mappingForm.patchValue(patch);
    this.applyAuditPeriodFromTemplate(template);
  }

  private applyAuditPeriodFromTemplate(template: IExcelMappingDto): void {
    if (template.auditMonth != null) {
      const year = template.auditYear ?? this.auditYearDate()?.getFullYear() ?? new Date().getFullYear();
      this.auditMonthDate.set(new Date(year, template.auditMonth - 1, 1));
    } else {
      this.auditMonthDate.set(null);
    }

    if (template.auditYear != null) {
      this.auditYearDate.set(new Date(template.auditYear, 0, 1));
    } else {
      this.auditYearDate.set(null);
    }
  }

  private resolveAuditMonth(): number | undefined {
    const monthDate = this.auditMonthDate();
    if (!monthDate) return undefined;
    return monthDate.getMonth() + 1;
  }

  private resolveAuditYear(): number | undefined {
    const yearDate = this.auditYearDate();
    if (yearDate) return yearDate.getFullYear();
    const monthDate = this.auditMonthDate();
    if (monthDate) return monthDate.getFullYear();
    return undefined;
  }

  back(): void {
    const current = this.step();
    if (current > 1) this.step.set((current - 1) as Step);
  }

  cancelEmit(): void {
    this.reset();
    this.cancel.emit();
  }

  async finish(): Promise<void> {
    const template = this.currentTemplate();
    const records = this.mappingService.applyTemplate(this.rows, template);

    if (this.saveTemplate()) {
      try {
        await this.mappingService.saveTemplate(template);
        this.alerts.success('Template saved', `"${template.accountName}" is now available for reuse.`);
      } catch (err: any) {
        this.alerts.error('Save failed', err?.message ?? 'Could not save the template.');
        return;
      }
    }

    this.confirm.emit({ records, template, saveTemplate: this.saveTemplate() });
    this.reset();
  }

  private currentTemplate(): IExcelMappingDto {
    const meta = this.metaForm.getRawValue() as {
      accountName: string;
      category: 'Retail' | 'Wholesale';
      dateFormat: string;
    };
    const mappingValue = this.mappingForm.getRawValue() as Record<string, string>;
    const propertiesMap: ISaleRecordMappingProperties = {
      orderId: (mappingValue['orderId'] ?? '').trim(),
      sku: (mappingValue['sku'] ?? '').trim(),
      itemCost: (mappingValue['itemCost'] ?? '').trim(),
      itemQuantity: (mappingValue['itemQuantity'] ?? '').trim(),
      orderPlaceDate: (mappingValue['orderPlaceDate'] ?? '').trim(),
      total: (mappingValue['total'] ?? '').trim(),
    };
    return {
      accountName: meta.accountName.trim(),
      sheetName: this.selectedSheet(),
      category: meta.category,
      dateFormat: meta.dateFormat.trim() || undefined,
      auditMonth: this.resolveAuditMonth(),
      auditYear: this.resolveAuditYear(),
      propertiesMap,
    };
  }

  private reset(): void {
    this.step.set(1);
    this.sheetNames.set([]);
    this.selectedSheet.set('');
    this.headers.set([]);
    this.rows = [];
    this.previewRecords.set([]);
    this.totalMappedCount.set(0);
    this.saveTemplate.set(false);
    this.chosenFile.set(null);
    this.auditMonthDate.set(null);
    this.auditYearDate.set(null);
    this.metaForm.reset({ accountName: '', category: 'Retail', dateFormat: '' });
    this.mappingForm.reset(
      SALE_MAPPING_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as Record<string, string>)
    );
  }
}
