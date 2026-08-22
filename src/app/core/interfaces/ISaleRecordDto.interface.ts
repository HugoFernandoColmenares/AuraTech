export interface ISaleRecordDto {
  id: string;
  orderId: string;
  idx: number;
  orderStatus: string;
  warehouseCode: string;
  account: string; // The source platform/account name (e.g., 'AMAZON DS', 'FAIRE')
  channel?: string; // Optional: The specific sales channel (e.g., retailer name for Faire)
  category: 'Retail' | 'Wholesale'; // Classification for the sale
  orderPlaceDate: Date | null;
  sku: string;
  itemCost: number;
  itemQuantity: number;
  total: number;
  brand?: string;       // Brand crossed from Reference Sheet
  collection?: string;  // Collection crossed from Reference Sheet
  isLocal?: boolean;    // Flag to identify records not yet in DB
  auditMonth?: number | string;
  auditYear?: number | string;
}

export type StoreType = 'amazon-dropshipping' | 'amazon-retail' | 'fashion-go' | 'ymi-retail' | 'faire' | 'ymi-internal' | 'ymi-wholesale' | 'rmf-website' | 'generic-sales-report' | 'walmart-wfs' | 'custom-excel';

export interface ISaleRecordView extends ISaleRecordDto {
  parent?: string;
  color?: string;
  size?: string;
  styleName?: string;
}
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