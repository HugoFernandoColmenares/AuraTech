import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { DateUtils } from '@core/auxiliar/date.utils';
import { parseCurrency, parseInteger } from '@core/auxiliar/excel-parse.utils';

/**
 * Generic helper to map raw Excel/JSON data to ISaleRecordDto.
 * It also handles date normalization and audit month/year extraction.
 */
export function mapRawToSaleRecord(
  row: any,
  idx: number,
  options: {
    account: string;
    category: 'Retail' | 'Wholesale';
    warehouseCodeField?: string;
    orderIdField?: string;
    orderStatusField?: string;
    dateField?: string;
    skuField?: string;
    itemCostField?: string;
    itemQuantityField?: string;
    brand?: string;
    collection?: string;
  }
): ISaleRecordDto {
  const {
    account,
    category,
    warehouseCodeField = 'Warehouse Code',
    orderIdField = 'Order ID',
    orderStatusField = 'Order Status',
    dateField = 'Order Place Date',
    skuField = 'SKU',
    itemCostField = 'Item Cost',
    itemQuantityField = 'Item Quantity',
    brand = 'Unknown',
    collection = 'None'
  } = options;

  const orderPlaceDate = DateUtils.parseDate(row[dateField]);
  
  // Extract audit year and month from date if not present in row
  const auditYear = row['auditYear'] || (orderPlaceDate ? DateUtils.getYearKey(orderPlaceDate) : 2025);
  const auditMonth = row['auditMonth'] || (orderPlaceDate ? DateUtils.getMonthKey(orderPlaceDate) + 1 : 1);

  const itemCost = parseCurrency(row[itemCostField]);
  const itemQuantity = parseInteger(row[itemQuantityField]);

  return {
    id: generateGuid(),
    isLocal: true,
    orderId: String(row[orderIdField] || '').trim(),
    idx,
    orderStatus: String(row[orderStatusField] || '').trim(),
    warehouseCode: String(row[warehouseCodeField] || '').trim(),
    orderPlaceDate,
    sku: String(row[skuField] || '').trim(),
    itemCost,
    itemQuantity: Math.abs(itemQuantity),
    account,
    category,
    total: Math.abs(itemCost * itemQuantity),
    brand,
    collection,
    auditMonth,
    auditYear
  };
}
