export class DateUtils {
  /**
   * Extrae directamente el año y el mes como componentes atómicos en formato string (ej: "2025-01")
   * abstrayendo al sistema de desbordamientos de objetos Date locales.
   */
  static getYearMonthKey(rawVal: any): string {
    if (rawVal === undefined || rawVal === null) return 'Unknown';
    
    const str = String(rawVal).trim();
    if (str.includes('/')) {
      const parts = str.split(' ')[0].split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}`;
      }
    }

    const date = this.parseDate(rawVal);
    if (!date || isNaN(date.getTime())) return 'Unknown';
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Genera de forma segura la llave de agrupación ISO de la semana (ej: "2025-W01")
   * evitando mutaciones in situ.
   */
  static getISOWeekKey(rawVal: any): string {
    const date = this.parseDate(rawVal);
    if (!date || isNaN(date.getTime())) return 'Unknown';

    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * Extrae el año puro como número de forma segura.
   */
  static getYearKey(rawVal: any): number {
    const key = this.getYearMonthKey(rawVal);
    if (key === 'Unknown') return new Date().getFullYear();
    return parseInt(key.split('-')[0], 10);
  }

  /**
   * Extrae el mes puro (0-11) de forma segura.
   */
  static getMonthKey(rawVal: any): number {
    const key = this.getYearMonthKey(rawVal);
    if (key === 'Unknown') return 0;
    return parseInt(key.split('-')[1], 10) - 1;
  }

  static parseDate(rawVal: any): Date | null {
    if (rawVal === undefined || rawVal === null) return null;
    
    if (rawVal instanceof Date) {
      if (isNaN(rawVal.getTime())) return null;
      return new Date(Date.UTC(rawVal.getUTCFullYear(), rawVal.getUTCMonth(), rawVal.getUTCDate()));
    }

    const strVal = String(rawVal).trim();
    if (strVal === '') return null;

    if (!isNaN(Number(strVal)) && !strVal.includes('/') && !strVal.includes('-')) {
      return this.parseExcelSerialDate(parseFloat(strVal));
    }

    const customDate = this.parseCustomString(strVal);
    if (customDate) return customDate;

    // Fallback for standard ISO strings or native Date.parse
    const fallback = new Date(strVal);
    if (!isNaN(fallback.getTime())) {
      // Normalize to UTC midnight to avoid local timezone shifts during aggregations
      return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
    }

    return null;
  }

  static parseExcelSerialDate(serialDate: number): Date {
    if (isNaN(serialDate)) return new Date(NaN);
    const excelEpoch = Date.UTC(1899, 11, 30);
    const msInDay = 24 * 60 * 60 * 1000;
    return new Date(excelEpoch + Math.round(serialDate * msInDay));
  }

  static parseCustomString(str: string): Date | null {
    if (!str) return null;
    
    const separator = str.includes('/') ? '/' : (str.includes('-') ? '-' : null);
    if (separator) {
      const parts = str.split(' ');
      const datePart = parts[0]; 
      const timePart = parts[1] || "00:00";
      const dateSegments = datePart.split(separator).map(Number);

      if (dateSegments.length === 3) {
        const [hours, minutes] = timePart.split(':').map(Number);
        
        let month = dateSegments[0];
        let day = dateSegments[1];
        let year = dateSegments[2];

        if (month > 12 && month <= 31) {
          day = dateSegments[0];
          month = dateSegments[1];
        }
        if (month > 1000) {
          year = dateSegments[0];
          month = dateSegments[1];
          day = dateSegments[2];
        }

        const targetDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
        if (!isNaN(targetDate.getTime())) return targetDate;
      }
    }
    return null;
  }

  /**
   * Método restaurado y adaptado a UTC para solucionar el error de compilación.
   */
  static getWeekNumber(date: Date): number {
    if (!date || isNaN(date.getTime())) return 0;
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  static now(): Date {
    return new Date();
  }

  static getMonthLabel(monthIndex: number): string {
    const labels = this.getMonthLabels();
    return labels[monthIndex] || String(monthIndex + 1);
  }

  static getMonthLabels(): string[] {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }

  static formatToDateString(date: Date): string {
    if (!date || isNaN(date.getTime())) return '';
    return this.formatCalendarDate(date);
  }

  /** ISO yyyy-mm-dd as UTC midnight (for filter boundaries). */
  static parseIsoDate(iso: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return this.parseDate(iso);
    return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  }

  /** End of civil day in UTC for inclusive end-date filters. */
  static endOfIsoDay(iso: string): Date | null {
    const start = this.parseIsoDate(iso);
    if (!start) return null;
    return new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 23, 59, 59, 999)
    );
  }

  /** yyyy-mm-dd from a calendar (local) DatePicker selection. */
  static formatCalendarDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** yyyy-mm-dd from UTC calendar parts (filter boundaries / audit period). */
  static formatUtcDateString(date: Date): string {
    if (!date || isNaN(date.getTime())) return '';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Local Date for PrimeNG display from stored yyyy-mm-dd. */
  static calendarDateFromIso(iso: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!match) return this.parseDate(iso);
    return new Date(+match[1], +match[2] - 1, +match[3]);
  }

  /** ISO yyyy-mm-dd → US display mm-dd-yyyy */
  static toUsDisplay(isoYmd: string): string {
    if (!isoYmd) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd.trim());
    if (!match) return isoYmd;
    const [, year, month, day] = match;
    return `${month}-${day}-${year}`;
  }

  /** US display MM/DD/YYYY → ISO yyyy-mm-dd (empty if invalid) */
  static fromUsDisplay(usDate: string): string {
    const trimmed = usDate.trim();
    if (!trimmed) return '';
    const parsed = this.parseCustomString(trimmed);
    return parsed ? this.formatToDateString(parsed) : '';
  }
}