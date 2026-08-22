import { TableColumn } from '@shared/components/data-table/data-table.component';

export interface ColumnVisibilityState {
  showAccount: boolean;
  isSkuSplit: boolean;
  showCost: boolean;
  showStyleName: boolean;
}

export function generateSalesTableColumns(state: ColumnVisibilityState): TableColumn[] {
  const base: TableColumn[] = [];

  if (state.showAccount) base.push({ key: 'account', label: 'Account' });
  
  base.push({ key: 'orderPlaceDate', label: 'Order Date', type: 'date' });

  if (!state.isSkuSplit) {
    // Si showStyleName es true, mostramos el nombre del estilo, si no el SKU
    const key = state.showStyleName ? 'fullStyleName' : 'sku';
    const label = state.showStyleName ? 'Product Name' : 'SKU';
    base.push({ key, label, cssClass: 'mono' });
  } else {
    // Si está dividido, el styleName reemplaza al Parent si el toggle está activo
    const parentLabel = state.showStyleName ? 'Product Name' : 'Parent';
    const parentKey = state.showStyleName ? 'styleName' : 'parent';
    
    base.push({ key: parentKey, label: parentLabel, cssClass: 'mono' });
    base.push({ key: 'color', label: 'Color', cssClass: 'mono' });
    base.push({ key: 'size', label: 'Size', cssClass: 'mono' });
  }

  if (state.showCost) base.push({ key: 'itemCost', label: 'Cost', type: 'currency' });
  
  base.push({ key: 'itemQuantity', label: 'Qty', type: 'number', cssClass: 'text-center' });
  base.push({ key: 'total', label: 'Total', type: 'currency' });

  base.push({ key: 'actions', label: 'Actions', type: 'action', cssClass: 'text-center' });

  return base;
}
