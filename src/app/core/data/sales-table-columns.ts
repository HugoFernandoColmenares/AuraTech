import { TableColumn } from '@shared/components/data-table/data-table.component';

export interface ColumnVisibilityState {
  showAccount: boolean;
  showCost: boolean;
  showStyleName: boolean;
}

export function generateSalesTableColumns(state: ColumnVisibilityState): TableColumn[] {
  const base: TableColumn[] = [];

  if (state.showAccount) base.push({ key: 'account', label: 'Account' });

  base.push({ key: 'orderPlaceDate', label: 'Order Date', type: 'date' });

  const key = state.showStyleName ? 'fullStyleName' : 'sku';
  const label = state.showStyleName ? 'Product Name' : 'SKU';
  base.push({ key, label, cssClass: 'mono' });

  if (state.showCost) base.push({ key: 'itemCost', label: 'Cost', type: 'currency' });
  
  base.push({ key: 'itemQuantity', label: 'Qty', type: 'number', cssClass: 'text-center' });
  base.push({ key: 'total', label: 'Total', type: 'currency' });

  base.push({ key: 'actions', label: 'Actions', type: 'action', cssClass: 'text-center' });

  return base;
}
