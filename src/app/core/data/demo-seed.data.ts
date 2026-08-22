import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { generateGuid } from '@core/auxiliar/guid-utils';

const ACCOUNTS = ['Retail Web', 'Wholesale', 'Marketplace'] as const;
const SKUS = [
  { sku: 'AT-DENIM-01-32', brand: 'Aura', collection: 'Core', parent: 'AT-DENIM-01' },
  { sku: 'AT-DENIM-02-30', brand: 'Aura', collection: 'Core', parent: 'AT-DENIM-02' },
  { sku: 'AT-JOGGER-11-M', brand: 'Lumen', collection: 'Athleisure', parent: 'AT-JOGGER-11' },
  { sku: 'AT-TEE-20-L', brand: 'Lumen', collection: 'Basics', parent: 'AT-TEE-20' },
  { sku: 'AT-JACKET-04-S', brand: 'Nimbus', collection: 'Outerwear', parent: 'AT-JACKET-04' },
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
      const sku = SKUS[(idx + i) % SKUS.length];
      const account = ACCOUNTS[(idx + i) % ACCOUNTS.length];
      const qty = 2 + ((idx + i) % 8);
      const cost = 18 + ((idx + i) % 12) * 3.5;
      const day = 4 + ((idx + i) % 22);
      const orderPlaceDate = new Date(Date.UTC(year, month - 1, day));

      rows.push({
        id: generateGuid(),
        orderId: `AT-${year}${String(month).padStart(2, '0')}-${String(idx + i).padStart(4, '0')}`,
        idx: i + 1,
        orderStatus: 'Shipped',
        warehouseCode: 'WH-DEMO',
        account,
        channel: account === 'Wholesale' ? 'B2B' : 'DTC',
        category: account === 'Wholesale' ? 'Wholesale' : 'Retail',
        orderPlaceDate,
        sku: sku.sku,
        itemCost: Number(cost.toFixed(2)),
        itemQuantity: qty,
        total: Number((cost * qty).toFixed(2)),
        brand: sku.brand,
        collection: sku.collection,
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
  return SKUS.map((item, i) => ({
    id: generateGuid(),
    sku: item.sku,
    parent: item.parent,
    styleName: item.sku.startsWith('AT-JOGGER')
      ? 'Everyday Jogger'
      : item.sku.startsWith('AT-TEE')
        ? 'Essential Tee'
        : item.sku.startsWith('AT-JACKET')
          ? 'City Jacket'
          : 'Stretch Denim',
    isActive: true,
    brand: item.brand,
    division: i % 2 === 0 ? 'Womens' : 'Mens',
    type: item.sku.includes('TEE') ? 'Tops' : 'Bottoms',
    collection: item.collection,
    fit: 'Regular',
    isLocal: false,
  }));
}
