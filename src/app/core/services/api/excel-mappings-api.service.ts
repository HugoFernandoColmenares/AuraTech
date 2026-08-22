import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IExcelMappingDto } from '../../interfaces/IExcelMappingDto.interface';

/**
 * Persistence for reusable custom Excel mapping templates.
 * Templates are global/shared across authenticated users (see RLS policy in
 * migration `20260707120000_excel_mappings.sql`).
 */
@Injectable({
  providedIn: 'root',
})
export class ExcelMappingsApiService extends BaseSupabaseApiService<IExcelMappingDto> {
  protected override tableKey = 'excelMappings' as const;
  protected override useListCache = true;
  protected override orderColumn = 'account_name';

  /** Returns the template whose account name matches, or null when not found. */
  async getByAccountName(accountName: string): Promise<IExcelMappingDto | null> {
    const all = await this.ensureListCache();
    const normalized = accountName.trim().toLowerCase();
    return all.find(t => t.accountName.trim().toLowerCase() === normalized) ?? null;
  }
}
