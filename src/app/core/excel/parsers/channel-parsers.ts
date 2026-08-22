import { DateUtils } from '@core/auxiliar/date.utils';
import { parseCurrency, parseDecimalLocale, parseInteger } from '@core/auxiliar/excel-parse.utils';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { findReferenceByParent, lookupBrandCollection } from '@core/auxiliar/reference-lookup.utils';
import { mapRawToSaleRecord } from '@core/auxiliar/sales-mapping.helper';
import { toPgIntegerOptional } from '@core/auxiliar/sale-record-sanitize.util';
import { IInventoryRecordDto } from '@core/interfaces/IInventoryRecordDto.interface';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ParserValidationError, SalesParserContext } from '../sales-parser.context';

/** Order IDs that must be excluded from every imported file (exact match) */
const EXCLUDED_ORDER_IDS = new Set([
  'From Karen Heiserman', // manual data entry artifact
  'Order ID', // header row duplicated when merging Excel files manually
]);

/**
 * Prefixes - rows are excluded when either `Order ID` OR `Order Status`
 * starts with one of these strings (e.g. UPS tracking numbers leaked into
 * status/id columns when files are merged manually).
 */
const EXCLUDED_FIELD_PREFIXES = ['1ZXH0456'];

export function parseAmazonDropshipping(
  jsonData: Record<string, unknown>[],
  ctx: SalesParserContext
): ISaleRecordDto[] {
  const hasExcludedPrefix = (value: string) => EXCLUDED_FIELD_PREFIXES.some(p => value.startsWith(p));

  return jsonData
    .filter(row => {
      const orderId = String(row['Order ID'] ?? '').trim();
      const orderStatus = String(row['Order Status'] ?? '').trim();
      if (EXCLUDED_ORDER_IDS.has(orderId)) return false;
      if (hasExcludedPrefix(orderId)) return false;
      if (hasExcludedPrefix(orderStatus)) return false;
      return true;
    })
    .map((row: Record<string, unknown>, idx: number) => {
      const rawSku = String(row['SKU'] || '');
      const { brand, collection } = lookupBrandCollection(rawSku, ctx.referenceList);

      return mapRawToSaleRecord(row, idx, {
        account: 'Amazon Dropship',
        category: 'Retail',
        brand,
        collection,
      });
    })
    .filter(r => !hasExcludedPrefix(r.orderId) && !hasExcludedPrefix(r.orderStatus));
}

export function parseAmazonRetail(
  jsonData: Record<string, unknown>[],
  ctx: SalesParserContext
): ISaleRecordDto[] {
  return jsonData
    .map((row, idx) => {
      const itemCost = parseCurrency(row['Cost']);
      const itemQuantity = parseInteger(row['Accepted quantity']);
      const sku = String(row['Model number'] || row['Merchant SKU'] || '');
      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id: generateGuid(),
        isLocal: true,
        orderId: String(row['PO'] || ''),
        idx,
        orderStatus: String(row['Status'] || ''),
        warehouseCode: String(row['Vendor code'] || ''),
        orderPlaceDate: DateUtils.parseDate(row['Order date'] as string | undefined),
        sku,
        itemCost,
        itemQuantity: Math.abs(itemQuantity),
        account: 'Amazon RP',
        category: 'Retail',
        total: Math.abs(itemCost * itemQuantity),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}

export function parseFashionGo(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  const seenOrders = new Set<string>();

  return jsonData
    .map((row, idx) => {
      const style = String(row['vendorStyleNo'] || row['styleNo'] || '').trim();
      const color = String(row['Color/Scent'] || '').trim();
      const sku = color ? `${style}-${color}` : style;

      let brand = 'Unknown';
      let collection = 'None';
      if (style) {
        const matched = findReferenceByParent(ctx.referenceList, style);
        if (matched) {
          brand = matched.brand || 'Unknown';
          collection = matched.collection || 'None';
        }
      }

      const rawDateStr = String(row['orderDate'] || '').trim();
      let auditMonth = '4';
      let auditYear = '2026';

      if (rawDateStr.includes('/')) {
        const datePart = rawDateStr.split(' ')[0];
        const parts = datePart.split('/');
        if (parts.length === 3) {
          auditMonth = String(parseInt(parts[0], 10));
          auditYear = parts[2].trim();
        }
      }

      const itemCost = parseDecimalLocale(row['unitPrice']);
      const itemQuantity = parseDecimalLocale(row['totalQty']);
      let total = parseDecimalLocale(row['subTotal']);
      if (total === 0 && itemCost > 0) {
        total = itemCost * itemQuantity;
      }

      const orderId = String(row['orderId'] || row['poNumber'] || '').trim();
      const detailId = String(row['orderDetailId'] || idx).trim();
      const safeUtcDate = new Date(Date.UTC(parseInt(auditYear, 10), parseInt(auditMonth, 10) - 1, 1));

      return {
        id: `FG-${detailId}-${generateGuid()}`,
        isLocal: true,
        idx,
        orderId,
        orderStatus: String(row['orderStatus'] || 'Processed').trim(),
        warehouseCode: 'GEN',
        account: 'FG',
        category: 'Wholesale',
        orderPlaceDate: safeUtcDate,
        sku,
        itemCost: Number(itemCost.toFixed(2)),
        itemQuantity,
        total: Number(total.toFixed(2)),
        brand,
        collection,
        auditMonth,
        auditYear,
        channel: undefined,
      } satisfies ISaleRecordDto;
    })
    .filter(r => {
      if (!r.orderId || !r.sku) return false;

      const key = `${r.orderId}|${r.sku}|${r.itemQuantity}|${r.idx}`;
      if (seenOrders.has(key)) {
        return false;
      }
      seenOrders.add(key);
      return true;
    });
}

export function parseYmiRetail(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  return jsonData
    .map((row, idx) => {
      const itemCost = parseCurrency(row['Lineitem price']);
      const itemQuantity = parseInteger(row['Lineitem quantity']);
      const sku = String(row['Lineitem sku'] || '');
      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id: generateGuid(),
        isLocal: true,
        orderId: String(row['Name'] || ''),
        idx: parseInt(String(row['Id'] || '0'), 10) || idx,
        orderStatus: String(row['Financial Status'] || ''),
        warehouseCode: String(row['Location'] || 'Main Warehouse'),
        account: 'RETAIL',
        category: 'Retail',
        orderPlaceDate: DateUtils.parseDate(row['Created at']),
        sku,
        itemCost,
        itemQuantity: Math.abs(itemQuantity),
        total: Math.abs(itemCost * itemQuantity),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}

export function parseFaire(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  const parseGtinIdx = (value: unknown, fallbackIdx: number): number => {
    return toPgIntegerOptional(value) ?? fallbackIdx;
  };

  return jsonData
    .map((row, idx) => {
      const itemCost = parseCurrency(row['Wholesale Price']);
      const itemQuantity = parseInteger(row['Quantity']);
      const sku = String(row['SKU'] || '');
      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id: generateGuid(),
        isLocal: true,
        orderId: String(row['Order Number'] || ''),
        idx: parseGtinIdx(row['GTIN'], idx),
        orderStatus: String(row['Status'] || ''),
        warehouseCode: 'WH-01',
        account: 'Faire',
        channel: String(row['Retailer Name'] || ''),
        category: 'Wholesale',
        orderPlaceDate: DateUtils.parseDate(row['Ship Date']),
        sku,
        itemCost,
        itemQuantity: Math.abs(itemQuantity),
        total: Math.abs(itemCost * itemQuantity),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}

export function parseYmiInternalSales(rawData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  return rawData
    .map(row => {
      let category: 'Retail' | 'Wholesale' = 'Retail';
      if (row['category'] === 'Wholesale') {
        category = 'Wholesale';
      }

      const orderPlaceDate = DateUtils.parseDate(row['orderPlaceDate'] as string | undefined);
      const sku = String(row['sku'] || '');
      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id: String(row['id'] || crypto.randomUUID()),
        isLocal: true,
        orderId: String(row['orderId'] || ''),
        idx: Number(row['idx'] || 0),
        orderStatus: String(row['orderStatus'] || ''),
        warehouseCode: String(row['warehouseCode'] || ''),
        account: String(row['account'] || ''),
        channel: row['channel'] ? String(row['channel']) : undefined,
        category,
        orderPlaceDate,
        sku,
        itemCost: Number(row['itemCost'] || 0),
        itemQuantity: Math.abs(Number(row['itemQuantity'] || 0)),
        total: Math.abs(Number(row['total'] || 0)),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.sku && r.orderId);
}

export function parseYmiInternalInventory(rawData: Record<string, unknown>[]): IInventoryRecordDto[] {
  return rawData
    .map(row => ({
      id: String(row['id'] || crypto.randomUUID()),
      isLocal: true,
      sku: String(row['sku'] || ''),
      productName: String(row['productName'] || ''),
      onHand: Number(row['onHand'] || 0),
      committed: Number(row['committed'] || 0),
      available: Number(row['available'] || 0),
      onOrder: Number(row['onOrder'] || 0),
      onOrderAllocated: Number(row['onOrderAllocated'] || 0),
      onOrderAvailable: Number(row['onOrderAvailable'] || 0),
      earliestAvailable: row['earliestAvailable'] as Date | null,
      type: String(row['type'] || ''),
      division: String(row['division'] || ''),
      collection: row['collection'] ? String(row['collection']) : 'None',
      fit: row['fit'] ? String(row['fit']) : 'None',
      sourceFile: String(row['sourceFile'] || 'YMI Export'),
      xref: row['xref'] ? String(row['xref']) : 'None',
    }))
    .filter(r => r.sku);
}

export function validateYmiWholesale(jsonData: Record<string, unknown>[]): ParserValidationError | null {
  if (!jsonData || jsonData.length === 0) {
    return {
      title: 'Empty File',
      message: 'The uploaded YML Wholesale Excel sheet contains no data rows.',
    };
  }

  const firstRow = jsonData[0];
  const requiredKeys = ['Name', 'Lineitem sku'];
  const missingKeys = requiredKeys.filter(key => !(key in firstRow));

  if (missingKeys.length > 0) {
    return {
      title: 'Format Incompatibility',
      message: `The file is missing columns required for YML Wholesale: ${missingKeys.join(', ')}.`,
    };
  }

  return null;
}

export function parseYmiWholesale(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  let activeIdx = 0;
  let activeStatus = 'paid';

  return jsonData
    .map((row, index) => {
      const idVal = row['Id'];
      if (idVal !== undefined && idVal !== null && String(idVal).trim() !== '') {
        const parsed = Number(String(idVal).replace(/,/g, ''));
        if (!isNaN(parsed) && Number.isSafeInteger(parsed) && parsed <= 2147483647) {
          activeIdx = Math.floor(parsed);
        } else {
          activeIdx = 0;
        }
      }

      const statusVal = String(row['Financial Status'] || '').trim();
      if (statusVal) {
        activeStatus = statusVal;
      }

      const sku = String(row['Lineitem sku'] || '').trim();
      const itemCost = parseCurrency(row['Lineitem price']);
      const itemQuantity = parseInteger(row['Lineitem quantity']);
      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id: generateGuid(),
        isLocal: true,
        orderId: String(row['Name'] || ''),
        idx: activeIdx || index,
        orderStatus: activeStatus,
        warehouseCode: String(row['Location'] || '').trim() || 'DEFAULT',
        account: 'WHOLESALES',
        channel: String(row['Billing Company'] || '').trim(),
        category: 'Wholesale',
        orderPlaceDate: DateUtils.parseDate(row['Created at']),
        sku,
        itemCost,
        itemQuantity: Math.abs(itemQuantity),
        total: Math.abs(itemCost * itemQuantity),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}

export function parseRmfWebsite(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  const parseLongInt = (value: unknown): number => {
    if (value === undefined || value === null) return 0;
    const s = String(value).replace(/,/g, '');
    const n = Number(s);
    if (isNaN(n) || n > 2147483647 || n < -2147483648) return 0;
    return Math.floor(n);
  };

  return jsonData
    .map(row => {
      const itemCost = Number(row['Lineitem price'] || 0);
      const itemQuantity = Number(row['Lineitem quantity'] || 0);
      const sku = String(row['Lineitem sku'] || '');

      let brand = String(row['Brand'] || '');
      let collection = String(row['Collection'] || '');

      if (sku && (!brand || !collection)) {
        const parent = sku.split('-')[0];
        const matched = findReferenceByParent(ctx.referenceList, parent);
        if (matched) {
          if (!brand) brand = matched.brand || 'Unknown';
          if (!collection) collection = matched.collection || 'None';
        }
      }

      brand = brand || 'Unknown';
      collection = collection || 'None';

      return {
        id: generateGuid(),
        isLocal: true,
        orderId: String(row['Name'] || ''),
        idx: parseLongInt(row['Id']),
        orderStatus: String(row['Financial Status'] || ''),
        warehouseCode: String(row['Location'] || 'DEFAULT_WH'),
        account: 'RFM',
        channel: String(row['Vendor'] || 'RFM'),
        category: 'Retail',
        orderPlaceDate: DateUtils.parseDate(row['Created at']),
        sku,
        itemCost,
        itemQuantity: Math.abs(itemQuantity),
        total: Math.abs(itemCost * itemQuantity),
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}

export function parseGenericSales(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  return jsonData.map((row: Record<string, unknown>, idx: number) => {
    const rawSku = String(row['sku'] || '').trim();
    const itemCost = parseDecimalLocale(row['itemCost']);
    const itemQuantity = parseDecimalLocale(row['itemQuantity']);
    const account = String(row['Account'] || row['account'] || 'Generic Account').trim();
    const orderId = String(row['PO#'] || row['orderId'] || '').trim();
    const brandInFile = String(row['Brand'] || '').trim();

    const excelMonth =
      row['MONTH'] !== undefined && row['MONTH'] !== null
        ? String(row['MONTH']).trim()
        : row['auditMonth'] !== undefined && row['auditMonth'] !== null
          ? String(row['auditMonth']).trim()
          : '';

    const excelYear =
      row['YEAR'] !== undefined && row['YEAR'] !== null
        ? String(row['YEAR']).trim()
        : row['auditYear'] !== undefined && row['auditYear'] !== null
          ? String(row['auditYear']).trim()
          : '';

    const excelWeek =
      row['WEEK'] !== undefined && row['WEEK'] !== null
        ? String(row['WEEK']).trim()
        : row['channel'] !== undefined &&
            row['channel'] !== null &&
            String(row['channel']).startsWith('W')
          ? String(row['channel']).substring(1).trim()
          : '';

    const rawExcelTotal = row['total  ( J*I)'] || row['total'];
    let total = parseDecimalLocale(rawExcelTotal);

    if (total === 0 && itemCost > 0) {
      total = itemCost * itemQuantity;
    }

    let brand = brandInFile || 'Unknown';
    let collection = 'None';

    if (rawSku) {
      const parent = rawSku.split('-')[0];
      const matched = findReferenceByParent(ctx.referenceList, parent);
      if (matched) {
        if (!brandInFile || brandInFile === 'Unknown') {
          brand = matched.brand || 'Unknown';
        }
        collection = matched.collection || 'None';
      }
    }

    let safeUtcDate: Date | null = null;
    if (excelYear && excelMonth) {
      const y = parseInt(excelYear, 10);
      const m = parseInt(excelMonth, 10) - 1;
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
        safeUtcDate = new Date(Date.UTC(y, m, 1));
      }
    }

    return {
      id: `GEN-${String(idx)}-${generateGuid()}`,
      isLocal: true,
      orderId,
      idx,
      orderStatus: 'Processed',
      warehouseCode: 'GEN',
      orderPlaceDate: safeUtcDate,
      sku: rawSku,
      itemCost: Number(itemCost.toFixed(2)),
      itemQuantity,
      account,
      category: 'Retail',
      total: Number(total.toFixed(2)),
      brand,
      collection,
      auditMonth: excelMonth,
      auditYear: excelYear,
      channel: excelWeek ? `W${excelWeek}` : undefined,
    } satisfies ISaleRecordDto;
  });
}

export function parseWalmartWfs(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  return jsonData
    .map((row, idx) => {
      const normalizedRow: Record<string, unknown> = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.trim().toUpperCase()] = row[key];
      });

      const guid = generateGuid();
      const id = `WFS-${idx}-${guid}`;

      const orderId = String(normalizedRow['PURCHASE_ORDER_NUM'] || normalizedRow['SALES_ORDER_NUM'] || '');
      const orderStatus = String(normalizedRow['ORDER_STATUS'] || '');
      const sku = String(normalizedRow['VENDOR_SKU'] || '');
      const itemQuantity = parseInteger(normalizedRow['QUANTITY']);
      const total = parseCurrency(normalizedRow['GMV_AMT']);
      const itemCost = itemQuantity !== 0 ? total / itemQuantity : 0;

      const auditMonth = String(normalizedRow['MONTH'] || '1');
      const rawDateStr = String(normalizedRow['ORDER_PLACED_DT'] || '');
      const auditYear = rawDateStr.split('-')[0] || '2025';
      const channel = `W${auditMonth}`;

      const year = parseInt(auditYear, 10);
      const month = parseInt(auditMonth, 10);
      const orderPlaceDate = new Date(Date.UTC(year, month - 1, 1));

      const { brand, collection } = lookupBrandCollection(sku, ctx.referenceList);

      return {
        id,
        isLocal: true,
        idx,
        orderId,
        orderStatus,
        warehouseCode: 'GEN',
        account: 'Walmart',
        category: 'Retail',
        sku,
        itemQuantity: Math.abs(itemQuantity),
        total,
        itemCost,
        auditMonth,
        auditYear,
        channel,
        orderPlaceDate,
        brand,
        collection,
      } satisfies ISaleRecordDto;
    })
    .filter(r => r.orderId && r.sku);
}
