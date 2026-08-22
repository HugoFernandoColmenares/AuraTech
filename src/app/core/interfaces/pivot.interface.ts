export interface PivotRow {
  label: string;
  months: number[];
  total: number;
}

export interface PivotYearData {
  year: number;
  rows: PivotRow[];
  monthsTotal: number[];
  yearTotal: number;
}

export interface PivotTrend {
  months: number[];
  total: number;
}
