export interface IInventoryRecordDto {
    id: string;
    sku: string;
    productName: string;
    onHand: number;
    committed: number;
    available: number;
    onOrder: number;
    onOrderAllocated: number;
    onOrderAvailable: number;
    earliestAvailable: Date | null;
    type: string;
    division: string;
    collection: string;
    fit: string;
    sourceFile: string;
    xref: string;
    isLocal?: boolean;
}

export interface BreakdownRow {
  label: string;
  units: number;
  percentage: string;
}