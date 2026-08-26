import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { generateGuid } from '@core/auxiliar/guid-utils';

/** Fictional office/field catalog — not inherited from any prior client dataset. */
const ACCOUNTS = ['Direct', 'Partner', 'Outlet'] as const;
const ITEMS = [
  { sku: 'HX-1041', brand: 'Northline', collection: 'Launch', parent: 'HX-104', styleName: 'Desk Organizer', type: 'Accessories', division: 'Office' },
  { sku: 'HX-2210', brand: 'Harbor', collection: 'Core', parent: 'HX-221', styleName: 'LED Task Lamp', type: 'Lighting', division: 'Office' },
  { sku: 'FK-8803', brand: 'Fieldkit', collection: 'Trail', parent: 'FK-880', styleName: 'Utility Carry Case', type: 'Storage', division: 'Field' },
  { sku: 'NL-3308', brand: 'Northline', collection: 'Core', parent: 'NL-330', styleName: 'Monitor Stand', type: 'Furniture', division: 'Office' },
  { sku: 'HB-4412', brand: 'Harbor', collection: 'Seasonal', parent: 'HB-441', styleName: 'Cable Hub', type: 'Accessories', division: 'Office' },
] as const;

/** Synthetic sales for the current and prior year so KPIs and charts look populated. */
export function buildDemoSaleRecords(): ISaleRecordDto[] {
  const now = new Date();
  const rows: ISaleRecordDto[] = [];
  let idx = 0;

  for (let monthsBack = 0; monthsBack < 16; monthsBack++) {
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 12));
    const year = period.getUTCFullYear();
    const month = period.getUTCMonth() + 1;
    const volume = 6 + ((monthsBack * 3) % 5);

    for (let i = 0; i < volume; i++) {
      const item = ITEMS[(idx + i) % ITEMS.length];
      const account = ACCOUNTS[(idx + i) % ACCOUNTS.length];
      const qty = 2 + ((idx + i) % 8);
      const cost = 22 + ((idx + i) % 12) * 4.25;
      const day = 4 + ((idx + i) % 22);
      const orderPlaceDate = new Date(Date.UTC(year, month - 1, day));

      rows.push({
        id: generateGuid(),
        orderId: `ORD-${year}${String(month).padStart(2, '0')}-${String(idx + i).padStart(4, '0')}`,
        idx: i + 1,
        orderStatus: 'Shipped',
        warehouseCode: 'DC-EAST',
        account,
        channel: account === 'Partner' ? 'Wholesale' : 'DTC',
        category: account === 'Partner' ? 'Wholesale' : 'Retail',
        orderPlaceDate,
        sku: item.sku,
        itemCost: Number(cost.toFixed(2)),
        itemQuantity: qty,
        total: Number((cost * qty).toFixed(2)),
        brand: item.brand,
        collection: item.collection,
        styleName: item.styleName,
        parent: item.parent,
        isLocal: false,
        auditMonth: month,
        auditYear: year,
      });
    }
    idx += volume;
  }

  return rows;
}

export function buildDemoProducts(): IProductDto[] {
  return ITEMS.map(item => ({
    id: generateGuid(),
    sku: item.sku,
    parent: item.parent,
    styleName: item.styleName,
    isActive: true,
    brand: item.brand,
    type: item.type,
    collection: item.collection,
    isLocal: false,
  }));
}
