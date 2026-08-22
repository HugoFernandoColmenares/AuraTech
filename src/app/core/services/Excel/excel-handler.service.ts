import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExcelHandlerService {

  public hasYearSheets(workbook: XLSX.WorkBook): boolean {
    return workbook.SheetNames.some(name => /^(19|20)\d{2}$/.test(name.trim()));
  }

  public getYearSheets(workbook: XLSX.WorkBook): string[] {
    return workbook.SheetNames.filter(name => /^(19|20)\d{2}$/.test(name.trim()));
  }

  public getSheetData(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' }) as Record<string, unknown>[];
  }

  public parseToWorkbook(file: File): Promise<XLSX.WorkBook> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const result = e.target?.result;
          if (!(result instanceof ArrayBuffer)) {
            reject(new Error('Failed to read file as ArrayBuffer'));
            return;
          }
          const data = new Uint8Array(result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = err => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * NUEVO MÉTODO: Permite extraer datos de una hoja específica por su nombre de pila.
   * Implementa una búsqueda flexible (ignora espacios y mayúsculas/minúsculas).
   */
  public async parseExcelSheetByName(file: File, sheetName: string): Promise<Record<string, unknown>[]> {
    const workbook = await this.parseToWorkbook(file);
    const target = sheetName.trim().toUpperCase();

    // Buscamos el nombre real de la hoja que coincida con nuestro objetivo normalizado
    const actualSheetName = workbook.SheetNames.find(name => 
      name.trim().toUpperCase() === target
    );
    
    if (!actualSheetName) {
      throw new Error(`The required sheet "${sheetName}" was not found in the Excel workbook. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }
    
    return this.getSheetData(workbook, actualSheetName);
  }

  /**
   * Main parsing method for year sheets or first sheet fallback.
   */
  public async parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
    const workbook = await this.parseToWorkbook(file);

    if (this.hasYearSheets(workbook)) {
      const yearSheets = this.getYearSheets(workbook);
      const combinedData: Record<string, unknown>[] = [];
      for (const sheetName of yearSheets) {
        combinedData.push(...this.getSheetData(workbook, sheetName));
      }
      if (combinedData.length > 0) return combinedData;
    }

    if (workbook.SheetNames.length > 0) {
      const firstSheetName = workbook.SheetNames[0];
      const data = this.getSheetData(workbook, firstSheetName);
      if (data.length > 0) return data;
    }

    throw new Error('No readable sales or inventory data found in the Excel workbook sheets.');
  }

  // ── Custom Excel mapping support ────────────────────────────────────────────

  /** Lists the worksheet names contained in a workbook. */
  public async getSheetNames(file: File): Promise<string[]> {
    const workbook = await this.parseToWorkbook(file);
    return [...workbook.SheetNames];
  }

  /**
   * Reads a sheet as a flat object array where duplicate headers are disambiguated
   * with a sequential suffix (e.g. "Formula (Text)", "Formula (Text)_1", ...).
   *
   * This avoids the data loss that SheetJS' default `sheet_to_json` produces when
   * the same column header repeats (it keeps only the last value). Uses the
   * `header: 1` array-of-arrays mode and rebuilds the records manually.
   */
  public getSheetDataWithNormalizedHeaders(
    workbook: XLSX.WorkBook,
    sheetName: string
  ): { headers: string[]; rows: Record<string, unknown>[] } {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return { headers: [], rows: [] };

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    if (!matrix.length) return { headers: [], rows: [] };

    const headerRowIndex = this.detectHeaderRow(matrix);
    const rawHeaders = (matrix[headerRowIndex] as unknown[]).map((cell, i) =>
      this.sanitizeHeader(cell, i)
    );
    const headers = this.deduplicateHeaders(rawHeaders);

    const rows: Record<string, unknown>[] = [];
    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const values = matrix[r] as unknown[];
      if (!values || !values.length) continue;
      // Skip fully-empty rows.
      const hasValue = values.some(v => v !== '' && v != null);
      if (!hasValue) continue;

      const row: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        row[header] = i < values.length ? values[i] : '';
      });
      rows.push(row);
    }

    return { headers, rows };
  }

  /** Wrapper that opens the file, finds the sheet, and normalizes headers. */
  public async parseCustomSheet(
    file: File,
    sheetName: string
  ): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
    const workbook = await this.parseToWorkbook(file);
    const target = sheetName.trim().toUpperCase();
    const actualSheetName = workbook.SheetNames.find(
      name => name.trim().toUpperCase() === target
    );
    if (!actualSheetName) {
      throw new Error(
        `The required sheet "${sheetName}" was not found in the Excel workbook. Available sheets: ${workbook.SheetNames.join(', ')}`
      );
    }
    return this.getSheetDataWithNormalizedHeaders(workbook, actualSheetName);
  }

  private detectHeaderRow(matrix: unknown[][]): number {
    // Heuristic: the header row is the first row whose non-empty cell count is
    // at least half of the widest row. Guards against leading blank/title rows.
    let maxCells = 0;
    for (const row of matrix) {
      const nonEmpty = row.filter(c => c !== '' && c != null).length;
      if (nonEmpty > maxCells) maxCells = nonEmpty;
    }
    const threshold = Math.max(1, Math.ceil(maxCells / 2));
    for (let i = 0; i < matrix.length; i++) {
      const nonEmpty = matrix[i].filter(c => c !== '' && c != null).length;
      if (nonEmpty >= threshold) return i;
    }
    return 0;
  }

  private sanitizeHeader(cell: unknown, index: number): string {
    if (cell == null || String(cell).trim() === '') return `Column ${index + 1}`;
    return String(cell).trim();
  }

  private deduplicateHeaders(headers: string[]): string[] {
    const seen = new Map<string, number>();
    return headers.map(header => {
      const count = seen.get(header) ?? 0;
      seen.set(header, count + 1);
      return count === 0 ? header : `${header}_${count}`;
    });
  }
}