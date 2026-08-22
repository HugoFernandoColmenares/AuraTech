export interface ISaleRecordCureResult {
  dryRun: boolean;
  invalidRemoved: number;
  aggRemoved: number;
  summaryRemoved: number;
  lineCollapsed: number;
  duplicatesRemoved: number;
  normalized: number;
  totalWouldChange: number;
}
