import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IReferenceSheetDto } from '../../interfaces/IReferenceSheetDto.interface';
import { REFERENCE_SHEET_SELECT_COLUMNS } from '@core/auxiliar/reference-sheet-payload.util';

@Injectable({
  providedIn: 'root',
})
export class ReferenceSheetApiService extends BaseSupabaseApiService<IReferenceSheetDto> {
  protected override tableKey = 'referenceSheets' as const;
  protected override useListCache = true;
  protected override selectColumns = REFERENCE_SHEET_SELECT_COLUMNS;
  protected override orderColumn = 'parent';
}