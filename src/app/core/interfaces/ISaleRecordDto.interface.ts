export interface ISaleRecordDto {
  id: string;
  orderId: string;
  idx: number;
  orderStatus: string;
  warehouseCode: string;
  account: string;
  channel?: string;
  category: 'Retail' | 'Wholesale';
  orderPlaceDate: Date | null;
  sku: string;
  itemCost: number;
  itemQuantity: number;
  total: number;
  brand?: string;
  collection?: string;
  styleName?: string;
  parent?: string;
  isLocal?: boolean;
  auditMonth?: number | string;
  auditYear?: number | string;
}

export interface ISaleRecordView extends ISaleRecordDto {}
export type InsightSeverity = 'positive' | 'warning' | 'neutral' | 'info';

export interface InsightItem {
  icon: string;
  title: string;
  body: string;
  severity: InsightSeverity;
}

export interface InsightsReport {
  generatedAt: Date;
  totalRecords: number;
  sections: {
    profitability: InsightItem[];
    channelScope: InsightItem[];
    productAffinity: InsightItem[];
    recommendations: InsightItem[];
  };
}

export interface SalesFilters {
  search: string;
  account: string[];
  startDate: Date | null;
  endDate: Date | null;
  months?: number[];
}