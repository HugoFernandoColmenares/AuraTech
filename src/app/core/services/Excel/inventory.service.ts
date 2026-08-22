import { Injectable, inject, signal } from '@angular/core';
import { IInventoryRecordDto } from '@core/interfaces/IInventoryRecordDto.interface';
import { ReferenceSheetDataService } from '@core/services/Excel/reference-sheet-data.service';
import { YmiInternalReportService } from './ymi-internal-report.service';
import { ExcelHandlerService } from './excel-handler.service';
import { generateGuid } from '@core/auxiliar/guid-utils';
import {
  INVENTORY_PRIORITY_THRESHOLD,
  INVENTORY_URGENT_THRESHOLD,
  isInventoryPriority,
  isInventoryUrgent,
} from '@core/constants/inventory-thresholds.const';

export type InventoryAccount = 'Inventory Dashboard' | 'Hyperstretch RP' | 'WBB Luxe' | 'WH70' | 'WH10' | 'YMI Internal Export';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private referenceSheetService = inject(ReferenceSheetDataService);
  private ymiInternalService = inject(YmiInternalReportService);
  private excelHandler = inject(ExcelHandlerService);

  inventoryData = signal<IInventoryRecordDto[]>([]);

  readonly URGENT_THRESHOLD = INVENTORY_URGENT_THRESHOLD;
  readonly PRIORITY_THRESHOLD = INVENTORY_PRIORITY_THRESHOLD;

  constructor() { }

  setInventoryData(data: IInventoryRecordDto[]) {
    // Server data must not overwrite pending local session rows (unsaved uploads).
    // Merge: keep local rows (isLocal) and add server rows that don't collide by
    // business key (sku + sourceFile), marking them as non-local.
    const localPending = this.inventoryData().filter(r => r.isLocal);
    const serverRows = data.map(r => ({ ...r, isLocal: false }));
    const localKeys = new Set(localPending.map(r => `${r.sku}|${r.sourceFile}`));
    const merged = [...localPending, ...serverRows.filter(r => !localKeys.has(`${r.sku}|${r.sourceFile}`))];
    this.inventoryData.set(merged);
  }

  /** Rows imported in this browser session that are not yet in Supabase. */
  getLocalPendingData(): IInventoryRecordDto[] {
    return this.inventoryData().filter(r => r.isLocal);
  }

  addInventoryData(data: IInventoryRecordDto[]) {
    // When adding data from Excel, we want these to take precedence and be marked as local
    this.inventoryData.update(current => {
      const updated = [...current];
      data.forEach(newItem => {
        // Find if this record (SKU + Source) already exists in the signal
        const existingIdx = updated.findIndex(i => i.sku === newItem.sku && i.sourceFile === newItem.sourceFile);
        
        if (existingIdx !== -1) {
          // If it exists, we replace it with the new local data
          updated[existingIdx] = { ...newItem, isLocal: true };
        } else {
          // If it's new, we just append it
          updated.push({ ...newItem, isLocal: true });
        }
      });
      return updated;
    });
  }

  getUrgentCount() {
    return this.inventoryData().filter(item => isInventoryUrgent(item.available)).length;
  }

  getPriorityCount() {
    return this.inventoryData().filter(item => isInventoryPriority(item.available)).length;
  }

  async parseExcelFile(file: File, account: InventoryAccount): Promise<IInventoryRecordDto[]> {
    const wb = await this.excelHandler.parseToWorkbook(file);

    const sheetMap: Record<string, string> = {
      'Hyperstretch RP': 'OH WH 70',
      'Inventory Dashboard': 'INVENTORY OH',
      'WBB Luxe': 'WH 70',
      'WH70': 'Name',
      'WH10': 'Name'
    };

    let wsname: string | undefined = wb.SheetNames.find(name => 
      name.trim().toLowerCase() === (sheetMap[account] || '').toLowerCase()
    );

    if (!wsname) wsname = wb.SheetNames[0];

    const rawData = this.excelHandler.getSheetData(wb, wsname);

    if (account === 'YMI Internal Export') {
      return this.ymiInternalService.transformInventoryData(rawData);
    } else {
      return this.transformData(rawData, account, file.name);
    }
  }

  private transformData(rawData: any[], account: InventoryAccount, fileName: string): IInventoryRecordDto[] {
    const referenceData = this.referenceSheetService.getReferenceData()();
    
    return rawData.map(row => {
      let record: Partial<IInventoryRecordDto> = {
        id: generateGuid(),
        isLocal: true, // Mark as local for export logic
        sourceFile: account,
        committed: 0,
        onOrder: 0,
        onOrderAllocated: 0,
        onOrderAvailable: 0,
        earliestAvailable: null,
        collection: 'None',
        fit: 'None',
        xref: 'None'
      };

      switch (account) {
        case 'Inventory Dashboard':
          record.sku = String(row['Name'] || '');
          record.productName = String(row['Name'] || '');
          record.onHand = this.cleanNegative(row['On Hand']);
          record.available = this.cleanNegative(row['Available']);
          record.type = String(row['TYPE'] || '');
          record.division = String(row['DIV'] || '');
          record.collection = String(row['COLLECTION'] || '');
          break;

        case 'Hyperstretch RP':
          record.sku = String(row['Formula (Text)'] || '');
          record.productName = String(row['Formula (Text)'] || '');
          record.onHand = this.cleanNegative(row['On Hand']);
          record.available = this.cleanNegative(row['Available']);
          record.type = String(row['Item Group'] || '');
          record.division = String(row['Maximum of Class'] || '');
          record.collection = 'Hyperstretch';
          break;

        case 'WBB Luxe':
          const name = String(row['Name'] || '');
          record.sku = String(row['Formula (Text) (1ra)'] || '');
          record.productName = name;
          record.onHand = this.cleanNegative(row['On Hand']);
          record.available = this.cleanNegative(row['Available']);
          record.type = String(row['Item Group'] || '');
          record.division = String(row['Maximum of Class'] || '');
          record.collection = 'WBB Luxe';
          break;

        case 'WH70':
          record.sku = String(row['Formula (Text)'] || row['SKU'] || '');
          record.productName = String(row['Name'] || '');
          record.onHand = this.cleanNegative(row['On Hand']);
          record.available = this.cleanNegative(row['Available']);
          record.type = String(row['Item Group'] || '');
          record.division = String(row['Maximum of Class'] || '');
          record.collection = 'WH70';
          break;

        case 'WH10':
          const rawName = String(row['Name'] || '');
          // Extract SKU from "Name : SKU" or use as is
          record.sku = rawName.includes(':') ? rawName.split(':')[1].trim() : rawName;
          record.productName = rawName;
          record.onHand = this.cleanNegative(row['On Hand']);
          record.available = this.cleanNegative(row['Available']);
          record.type = String(row['Item Group'] || '');
          record.division = String(row['Maximum of Class'] || '');
          record.collection = 'WH10';
          break;
      }

      if (record.sku) {
        const parentCandidate = record.sku.split('-')[0].split(' ')[0];
        const masterRecord = referenceData.find(ref => 
          ref.parent === parentCandidate || record.sku?.startsWith(ref.parent)
        );

        if (masterRecord) {
          record.type = record.type || masterRecord.type;
          record.division = record.division || masterRecord.div;
          record.collection = record.collection || masterRecord.collection;
          record.fit = record.fit || masterRecord.fit;
        }
      }

      return record as IInventoryRecordDto;
    });
  }

  private cleanNegative(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : (num < 0 ? 0 : num);
  }
}
