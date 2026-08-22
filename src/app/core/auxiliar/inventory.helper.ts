import { IInventoryRecordDto } from "@core/interfaces/IInventoryRecordDto.interface";

// En tu inventory.helper.ts
export function buildRowViews(
  data: IInventoryRecordDto[], 
  isSplit: boolean, 
  urgentThreshold: number, 
  priorityThreshold: number
) {
  const skuTotals = new Map<string, number>();
  data.forEach(d => skuTotals.set(d.sku, (skuTotals.get(d.sku) ?? 0) + d.available));

  return data.map(d => {
    const total = skuTotals.get(d.sku) || 0;
    
    // Ahora usa las variables inyectadas, no números mágicos
    let status = 'Good';
    if (total <= urgentThreshold) status = 'Urgent';
    else if (total < priorityThreshold) status = 'Priority';

    const view: any = { ...d, status, division: d.division || 'None' };

    if (isSplit) {
      const parts = d.sku.split('-');
      view.family = parts[0] || '';
      view.color = parts[1] || '';
      view.size = parts[2] || '';
    }
    return view;
  });
}