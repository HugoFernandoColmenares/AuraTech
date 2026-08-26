import { Injectable, computed, inject, signal } from '@angular/core';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import {
  IExcelMappingDto,
  ISaleRecordMappingProperties,
} from '@core/interfaces/IExcelMappingDto.interface';
import { ExcelMappingsApiService } from '@core/services/api/excel-mappings-api.service';

/**
 * Descriptor of an {@link ISaleRecordDto} property that can be mapped from an
 * Excel column. Kept in the domain service so both the mapping UI and the
 * runtime parser share a single source of truth (DRY).
 *
 * `optional` fields may stay unmapped; every other field is required to
 * produce a valid sale record.
 */
export interface SaleMappingField {
  key: keyof ISaleRecordMappingProperties;
  label: string;
  optional?: boolean;
}

export const SALE_MAPPING_FIELDS: readonly SaleMappingField[] = [
  { key: 'orderId', label: 'Order ID' },
  { key: 'sku', label: 'SKU' },
  { key: 'itemCost', label: 'Item Cost' },
  { key: 'itemQuantity', label: 'Item Quantity' },
  { key: 'orderPlaceDate', label: 'Order Place Date' },
  { key: 'total', label: 'Total' },
] as const;

/**
 * Orchestrates custom Excel uploads: persists/retrieves mapping templates and
 * applies a template to a normalized row set to produce {@link ISaleRecordDto}s.
 *
 * Stays free of UI concerns (SRP): parsing lives in {@link ExcelHandlerService},
 * persistence in {@link ExcelMappingsApiService}.
 */
@Injectable({ providedIn: 'root' })
export class CustomExcelMappingService {
  private readonly mappingsApi = inject(ExcelMappingsApiService);

  private readonly templates = signal<IExcelMappingDto[]>([]);
  readonly templateList = computed(() => this.templates());

  /** Loads saved mapping templates. */
  async loadTemplates(): Promise<void> {
    try {
      const templates = await this.mappingsApi.ensureListCache();
      this.templates.set([...templates]);
    } catch {
      this.templates.set([]);
    }
  }

  /** Returns the saved template for an account name, or null. */
  getTemplate(accountName: string): IExcelMappingDto | null {
    const normalized = accountName.trim().toLowerCase();
    return this.templates().find(t => t.accountName.trim().toLowerCase() === normalized) ?? null;
  }

  /**
   * Validates a properties map: every required field must be assigned and no
   * Excel column may feed two different properties. Returns the list of error
   * messages (empty when valid).
   */
  validatePropertiesMap(map: Partial<ISaleRecordMappingProperties>): string[] {
    const errors: string[] = [];

    for (const field of SALE_MAPPING_FIELDS) {
      const value = (map[field.key] ?? '').trim();
      if (!field.optional && value === '') {
        errors.push(`${field.label} is required.`);
      }
    }

    const assigned = SALE_MAPPING_FIELDS
      .map(f => (map[f.key] ?? '').trim())
      .filter(v => v !== '');
    const duplicates = assigned.filter((value, index) => assigned.indexOf(value) !== index);
    for (const duplicate of [...new Set(duplicates)]) {
      errors.push(`Column "${duplicate}" is assigned to more than one field.`);
    }

    return errors;
  }

  /** Persists (insert or replace by account_name) a template. */
  async saveTemplate(dto: IExcelMappingDto): Promise<IExcelMappingDto> {
    const errors = this.validatePropertiesMap(dto.propertiesMap);
    if (errors.length) {
      throw new Error(errors.join(' '));
    }

    const existing = await this.mappingsApi.getByAccountName(dto.accountName);
    let saved: IExcelMappingDto;
    if (existing?.id) {
      saved = await this.mappingsApi.update(existing.id, dto);
    } else {
      saved = await this.mappingsApi.create(dto);
    }

    this.templates.update(list => {
      const filtered = list.filter(
        t => t.accountName.trim().toLowerCase() !== saved.accountName.trim().toLowerCase()
      );
      return [saved, ...filtered];
    });
    return saved;
  }

  /**
   * Maps normalized Excel rows to {@link ISaleRecordDto}s using a template.
   * Rows without orderId/sku are dropped.
   */
  applyTemplate(rows: Record<string, unknown>[], template: IExcelMappingDto): ISaleRecordDto[] {
    const map = template.propertiesMap;

    return rows
      .map((row, idx) => this.mapRow(row, map, template, idx))
      .filter(r => r.orderId && r.sku);
  }

  /** Builds a short preview (first `limit` rows) for the mapping UI. */
  previewRows(
    rows: Record<string, unknown>[],
    template: IExcelMappingDto,
    limit = 5
  ): ISaleRecordDto[] {
    return this.applyTemplate(rows.slice(0, limit), template);
  }

  private mapRow(
    row: Record<string, unknown>,
    map: ISaleRecordMappingProperties,
    template: IExcelMappingDto,
    idx: number
  ): ISaleRecordDto {
    const read = (key: keyof ISaleRecordMappingProperties): unknown =>
      row[(map[key] ?? '').trim()] ?? '';

    const orderId = String(read('orderId'));
    const sku = String(read('sku'));
    const itemQuantity = parseInteger(read('itemQuantity'));
    const total = parseCurrency(read('total'));
    const itemCost = parseCurrency(read('itemCost'));
    const derivedItemCost = itemCost !== 0 ? itemCost : itemQuantity !== 0 ? total / itemQuantity : 0;

    const { orderPlaceDate, auditMonth, auditYear } = this.resolveDates(row, map, template);
    const brand = String(row['Brand'] ?? row['brand'] ?? '').trim() || 'Unknown';
    const collection = String(row['Collection'] ?? row['collection'] ?? '').trim() || 'None';
    const id = `CUST-${idx}-${generateGuid()}`;

    return {
      id,
      isLocal: true,
      idx,
      orderId,
      orderStatus: '',
      warehouseCode: 'GEN',
      account: template.accountName,
      category: template.category,
      channel: '',
      sku,
      itemQuantity: Math.abs(itemQuantity),
      total,
      itemCost: derivedItemCost,
      auditMonth,
      auditYear,
      orderPlaceDate,
      brand,
      collection,
      styleName: sku,
      parent: sku,
    } satisfies ISaleRecordDto;
  }

  private resolveDates(
    row: Record<string, unknown>,
    map: ISaleRecordMappingProperties,
    template: IExcelMappingDto
  ): { orderPlaceDate: Date | null; auditMonth: number | string; auditYear: number | string } {
    const rawDate = (map.orderPlaceDate ?? '').trim() ? row[(map.orderPlaceDate ?? '').trim()] : '';
    const orderPlaceDate = this.parseDate(rawDate, template.dateFormat);

    let auditMonth: number | string =
      template.auditMonth ??
      (orderPlaceDate ? orderPlaceDate.getMonth() + 1 : new Date().getMonth() + 1);
    let auditYear: number | string =
      template.auditYear ??
      (orderPlaceDate ? orderPlaceDate.getFullYear() : new Date().getFullYear());

    const monthNum = typeof auditMonth === 'number' ? auditMonth : parseInt(String(auditMonth), 10);
    const yearNum = typeof auditYear === 'number' ? auditYear : parseInt(String(auditYear), 10);
    if (!Number.isNaN(monthNum)) auditMonth = monthNum;
    if (!Number.isNaN(yearNum)) auditYear = yearNum;

    return { orderPlaceDate, auditMonth, auditYear };
  }

  private parseDate(value: unknown, format?: string): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const str = String(value).trim();
    if (!str) return null;

    if (format?.toUpperCase().includes('DD/MM/YYYY') || /^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const [dd, mm, yyyy] = str.split(/[/\-.]/);
      const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
}

function parseCurrency(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(/[$,\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function parseInteger(value: unknown): number {
  const n = parseInt(String(value ?? '0'), 10);
  return Number.isNaN(n) ? 0 : n;
}
